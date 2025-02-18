import { db } from "./db/index.js";
import { todosTable } from "./db/schema.js";
import { ilike, eq } from "drizzle-orm";
import OpenAI from "openai";
import readlineSync from "readline-sync";

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

async function getAllTodos() {
  const todos = await db.select().from(todosTable);
  return todos;
}

async function createTodo(todo) {
  const [newTodo] = await db
    .insert(todosTable)
    .values({
      todo,
    })
    .returning({ id: todosTable.id });
  return newTodo.id;
}

async function searchTodos(search) {
  const todos = await db
    .select()
    .from(todosTable)
    .where(ilike(todosTable.todo, `%${search}%`));

  if (todos.length === 0) {
    return { message: "No todos found matching your query." };
  }

  return {
    message: "Here are the matching todos:",
    todos: todos.map((todo) => todo.todo), // Return only the todo texts
  };
}

async function deleteTodoById(id) {
  const deletedTodo = await db.delete(todosTable).where(eq(todosTable.id, id));
  return deletedTodo;
}

const tools = {
  getAllTodos: getAllTodos,
  createTodo: createTodo,
  searchTodos: searchTodos,
  deleteTodoById: deleteTodoById,
};

const SYSTEM_PROPT = `
You are an AI To-do list assistant with START, PLAN, ACTION, OBSERVATION AND OUTPUT state. Wait for the user prompt and first 
PLAN using available tools. After planning, take ACTION with appropriate tools and wait for OBSERVATION based on the action.
Once you get the observations, Return the AI response based on START prompts and Observations.

You can manage tasks by adding, viewing, updating and deleting tasks.
You must striclty follow the JSON output format for the response.

Todo database schema:
- id: Int and primary key
- todo: String
- created_at: Timestamp
- updated_at: Timestamp

Available Tools:
-getAllTodos(): Returns all the todos in the database.
-createTodo(todo:string): Creates a new todo in the database and takes todo as input as string and return id of created todo.
-searchTodos(): Searches for todos matching the query string using ilike operator in the database.
-deleteTodoById(id): Deletes a todo by its id in the database.

Example:
START
{'type': 'user', 'user': 'Add a task for studying Blockchain'}
{'type': 'plan', 'plan': 'If not enough context, I will try to get more context by asking questions'}
{'type': 'output', 'output': 'Can you give me more specific context on what do you want to add?'}
{'type': 'user', 'user': 'Add a task for studying Solidity and ZK-proofs in Blockchain'}
{'type': 'plan', 'plan': 'I will use createTodo tool to add a task for studying Blockchain in the Database'}
{'type': 'action', 'function': 'createTodo', 'input' : 'Study Solidity and ZK-proofs in Blockchain'}
{'type': 'observation', 'observation': '2'}
{'type': 'output', 'output': 'Your todo has been created successfully'}
`;

const messages = [{ role: "system", content: SYSTEM_PROPT }];

while (true) {
  const query = readlineSync.question("Enter your query: ");
  const userMessage = { type: "user", user: query };

  messages.push({ role: "user", content: JSON.stringify(userMessage) });

  while (true) {
    const chat = await client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: messages,
      response_format: { type: "json_object" },
    });
    const result = chat.choices[0].message.content;
    messages.push({ role: "assistant", content: result });

    const action = JSON.parse(result);

    if (action.type === "output") {
      console.log(`Output: ${action.output}`);
      break;
    } else if (action.type === "action") {
      const fn = tools[action.function];
      if (!fn) {
        messages.push({
          role: "assistant",
          content: JSON.stringify({
            type: "output",
            output: "Invalid function",
          }),
        });
        continue;
      }
      const observation = await fn(action.input);
      const formattedObservation = Array.isArray(observation)
        ? observation
            .map((todo) => `ID: ${todo.id}, Task: ${todo.todo}`)
            .join("\n")
        : observation;
      const observationMessage = {
        type: "observation",
        observation: formattedObservation,
      };
      messages.push({
        role: "assistant",
        content: JSON.stringify(observationMessage),
      });
    }
  }
}
