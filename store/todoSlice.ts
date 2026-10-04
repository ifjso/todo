import type { StateCreator } from "zustand";
import { api } from "@/lib/apiClient";
import type { Todo, TodoInput, TodoStatus } from "@/types";
import type { Store, StoreMiddlewares } from "./index";

export interface TodoSlice {
  todos: Todo[];
  todosLoaded: boolean;
  fetchTodos: () => Promise<void>;
  addTodo: (input: TodoInput) => Promise<Todo>;
  updateTodo: (id: string, input: Partial<TodoInput>) => Promise<Todo>;
  deleteTodo: (id: string) => Promise<void>;
  /** 드래그 앤 드롭: optimistic update 후 PATCH 1회. 실패 시 롤백하고 에러를 다시 던진다. */
  moveTodo: (id: string, status: TodoStatus, order: string) => Promise<void>;
}

function replace(todos: Todo[], todo: Todo): Todo[] {
  return todos.map((t) => (t._id === todo._id ? todo : t));
}

export const createTodoSlice: StateCreator<Store, StoreMiddlewares, [], TodoSlice> = (set, get) => ({
  todos: [],
  todosLoaded: false,

  fetchTodos: async () => {
    const todos = await api.todos.list();
    set({ todos, todosLoaded: true }, false, "todos/fetch");
  },

  addTodo: async (input) => {
    const todo = await api.todos.create(input);
    set((s) => ({ todos: [...s.todos, todo] }), false, "todos/add");
    void get().refreshProgress();
    return todo;
  },

  updateTodo: async (id, input) => {
    const todo = await api.todos.update(id, input);
    set((s) => ({ todos: replace(s.todos, todo) }), false, "todos/update");
    void get().refreshProgress();
    return todo;
  },

  deleteTodo: async (id) => {
    await api.todos.remove(id);
    set((s) => ({ todos: s.todos.filter((t) => t._id !== id) }), false, "todos/delete");
    void get().refreshProgress();
  },

  moveTodo: async (id, status, order) => {
    const previous = get().todos.find((t) => t._id === id);
    if (!previous) return;
    set((s) => ({ todos: replace(s.todos, { ...previous, status, order }) }), false, "todos/move:optimistic");
    try {
      const saved = await api.todos.patch(id, { status, order });
      set((s) => ({ todos: replace(s.todos, saved) }), false, "todos/move:commit");
    } catch (error) {
      set((s) => ({ todos: replace(s.todos, previous) }), false, "todos/move:rollback");
      throw error;
    }
    if (previous.status !== status) void get().refreshProgress();
  },
});
