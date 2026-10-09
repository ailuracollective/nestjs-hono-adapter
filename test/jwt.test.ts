/**
 * The cases that show `@nestjs/jwt` works on this adapter.
 *
 * The package sits on both sides of the adapter here, which is
 * why it is worth its own cases. Inside the application it
 * signs and verifies tokens; outside it, the guard reads a
 * token out of the `Authorization` header — a header the
 * adapter decoded from the request — and answers a refusal back
 * through the same adapter. The claims are that a token signed
 * in the container verifies in the container, that the header
 * survives the bridge far enough for a guard to read it, and
 * that a refusal is answered by Nest.
 */

import 'reflect-metadata';

import { expect, test } from 'bun:test';
import {
  Controller,
  Get,
  HttpStatus,
  Injectable,
  Module,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtModule, JwtService } from '@nestjs/jwt';
import {
  AuthGuard,
  PassportModule,
  PassportStrategy,
} from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import type { NestRequest } from '../src/index.ts';

import { request, startProbe } from './probe.ts';
import type { Probe } from './probe.ts';

/** The secret the module signs with. */
const SECRET = 'a-secret-only-the-fixture-knows';

/** The subject a token carries. */
const SUBJECT = 'hono-adapter';

/** The header the guard reads its token from. */
const BEARER = 'authorization';

/** How long a forged token claims to be valid for, in seconds. */
const FORGED_LIFETIME = 600;

/** The unit a token's expiry is written in. */
const MILLISECONDS_PER_SECOND = 1000;

/** The claims the strategy accepts. */
interface Claims {
  readonly sub: string;
}

/**
 * The strategy the guard resolves, which is where the signature
 * the adapter delivered is verified. It answers with the claims
 * it was given, so a case can tell which token arrived.
 */
@Injectable()
class TokenStrategy extends PassportStrategy(Strategy) {
  public constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: SECRET,
    });
  }

  public validate(claims: Claims): Claims {
    return claims;
  }
}

/** Whether a value is an object a key can be read out of. */
function isObject(
  body: unknown,
): body is Record<PropertyKey, unknown> {
  return typeof body === 'object' && body !== null;
}

/** The token a `Bearer` header carries, or `undefined`. */
function bearerOf(header: unknown): string | undefined {
  if (typeof header !== 'string') {
    return undefined;
  }
  return header.replace('Bearer ', '');
}

/** The body as an object, whatever the answer turned out to be. */
function objectOf(body: unknown): Record<PropertyKey, unknown> {
  if (!isObject(body)) {
    return {};
  }
  return body;
}

/**
 * The subject a guard resolved, whatever the guard left on the
 * request.
 */
function subjectOf(user: unknown): string {
  if (!isObject(user)) {
    return 'nobody';
  }
  const sub: unknown = Reflect.get(user, 'sub');
  if (typeof sub !== 'string') {
    return 'nobody';
  }
  return sub;
}

@Controller()
class TokenController {
  private readonly jwt: JwtService;

  public constructor(jwt: JwtService) {
    this.jwt = jwt;
  }

  /** Signs a token and answers with it. */
  @Get('token')
  public async token(): Promise<{ readonly token: string }> {
    return {
      token: await this.jwt.signAsync({ sub: SUBJECT }),
    };
  }

  /**
   * Verifies a token the caller sent and answers with the
   * subject it carries, so a case reads the claims rather than
   * the signature.
   *
   * The token is read off the request rather than off a
   * parameter decorator on purpose: this is the header the
   * adapter decoded, so a case that passes has shown the header
   * survived the bridge.
   */
  @Get('verify')
  public async verify(
    @Req() source: NestRequest,
  ): Promise<unknown> {
    const header = source.headers[BEARER];
    const token = bearerOf(header);
    return { subject: await this.subjectOf(token) };
  }

  private async subjectOf(
    token?: string,
  ): Promise<string | undefined> {
    if (token === undefined) {
      return undefined;
    }
    const verified = await this.jwt.verifyAsync<Claims>(token);
    return verified.sub;
  }
}

/**
 * A route under the package's own guard, which is the
 * composition an application writes: the guard is named by the
 * route and the strategy verifies what the adapter decoded from
 * the header.
 *
 * The route that signs lives in the controller above rather
 * than here, because a controller carries its guard over every
 * route in it — a signing route behind the guard could never be
 * reached to sign the token the guard is waiting for.
 */
@Controller('guarded')
@UseGuards(AuthGuard('jwt'))
class GuardedController {
  /** Answers with the subject the guard resolved from the token. */
  @Get()
  public whoami(@Req() source: NestRequest): {
    readonly sub: string;
  } {
    // The guard left what it resolved on the request, and the
    // adapter's own request type does not declare it: passport sets
    // the property at runtime, so it is read off the object rather
    // than asserted into the type.
    return { sub: subjectOf(Reflect.get(source, 'user')) };
  }
}

@Module({
  controllers: [TokenController, GuardedController],
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: SECRET,
      signOptions: { expiresIn: '10m' },
    }),
  ],
  providers: [TokenStrategy],
})
class TokenModule {}

/** How a case sends a token to the route that reads one. */
function authorized(token: string): RequestInit {
  return { headers: { [BEARER]: `Bearer ${token}` } };
}

/** Reads a token out of the answer the signing route gave. */
function tokenOf(body: unknown): string {
  const signed = objectOf(body);
  const token = Reflect.get(signed, 'token');
  if (typeof token !== 'string') {
    throw new TypeError(
      'the application answered without a token',
    );
  }
  return token;
}

async function withProbe<Answer>(
  read: (probe: Probe) => Promise<Answer>,
): Promise<Answer> {
  const probe = await startProbe({
    mode: 'in-process',
    module: TokenModule,
  });
  try {
    return await read(probe);
  } finally {
    await probe.close();
  }
}

test('a token signed in the application verifies in the application', async () => {
  await withProbe(async (probe) => {
    const signed = await request(probe, '/token');
    expect(signed.status).toBe(HttpStatus.OK);

    const verified = await request(
      probe,
      '/verify',
      authorized(tokenOf(signed.body)),
    );

    expect(verified.status).toBe(HttpStatus.OK);
    expect(verified.body).toStrictEqual({ subject: SUBJECT });
  });
});

test('a guarded route refuses a request that carries no token', async () => {
  await withProbe(async (probe) => {
    const response = await request(probe, '/guarded');

    expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
  });
});

test('a guarded route refuses a token signed with another secret', async () => {
  await withProbe(async (probe) => {
    const expiresAt =
      Math.floor(Date.now() / MILLISECONDS_PER_SECOND) +
      FORGED_LIFETIME;
    const claims = Buffer.from(
      JSON.stringify({ exp: expiresAt, sub: SUBJECT }),
    ).toString('base64url');
    const forged = `${claims}.forged-signature`;

    const response = await request(
      probe,
      '/guarded',
      authorized(forged),
    );

    expect(response.status).toBe(HttpStatus.UNAUTHORIZED);
  });
});

test('a guarded route accepts a token the application signed', async () => {
  await withProbe(async (probe) => {
    const issued = await request(probe, '/token');
    const response = await request(
      probe,
      '/guarded',
      authorized(tokenOf(issued.body)),
    );

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body).toStrictEqual({ sub: SUBJECT });
  });
});

test('a guarded route answers over a real connection', async () => {
  const probe = await startProbe({
    mode: 'socket',
    module: TokenModule,
  });
  try {
    const issued = await request(probe, '/token');
    const response = await request(
      probe,
      '/guarded',
      authorized(tokenOf(issued.body)),
    );

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.text).toBe(
      JSON.stringify({ sub: SUBJECT }),
    );
  } finally {
    await probe.close();
  }
});
