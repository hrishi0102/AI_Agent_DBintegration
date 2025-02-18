import { db } from "./db/index.js";
import { todosTable } from "./db/schema.js";
import { ilike } from "drizzle-orm";

async function getAllTodos() {
  const todos = await db.select().from(todosTable);
  return todos;
}

async function createTodo(todo) {
  const newTodo = await db.insert(todosTable).values({
    todo,
  });
  return newTodo;
}

async function searchTodos(search) {
  const todos = await db
    .select()
    .from(todosTable)
    .where(ilike(todosTable.todo, `%${search}%`));
  return todos;
}

async function deleteTodoById(id) {
  const deletedTodo = await db.delete(todosTable).where(eq(todosTable.id, id));
  return deletedTodo;
}
