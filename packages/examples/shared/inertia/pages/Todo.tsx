import { useEffect, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';

interface Todo {
  readonly done: boolean;
  readonly id: number;
  readonly text: string;
}

interface TodoProps {
  readonly message: string;
}

const STORAGE_KEY = 'todos';

const read = (): Todo[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? [] : (JSON.parse(stored) as Todo[]);
  } catch {
    return [];
  }
};

/** The example page: a todo list kept in the browser, so the server holds no state. */
export default function Todo({ message }: TodoProps): ReactElement {
  const [todos, setTodos] = useState<Todo[]>(read);
  const [text, setText] = useState('');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  }, [todos]);

  const add = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const value = text.trim();
    if (value === '') return;
    setTodos((current) => [...current, { done: false, id: Date.now(), text: value }]);
    setText('');
  };

  const toggle = (id: number): void => {
    setTodos((current) =>
      current.map((todo) => (todo.id === id ? { ...todo, done: !todo.done } : todo)),
    );
  };

  const remove = (id: number): void => {
    setTodos((current) => current.filter((todo) => todo.id !== id));
  };

  return (
    <main>
      <h1>Todo</h1>
      <p>{message}</p>
      <form onSubmit={add}>
        <input
          placeholder="What needs doing?"
          value={text}
          onChange={(event) => setText(event.currentTarget.value)}
        />
        <button type="submit">Add</button>
      </form>
      <ul>
        {todos.map((todo) => (
          <li key={todo.id}>
            <label>
              <input type="checkbox" checked={todo.done} onChange={() => toggle(todo.id)} />
              {todo.text}
            </label>
            <button type="button" onClick={() => remove(todo.id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
