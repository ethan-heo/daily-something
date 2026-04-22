import 'dotenv/config';
import { fetchTodayTodos, upsertTodoEvents } from './run';

async function main(): Promise<void> {
  const { date, items } = await fetchTodayTodos();

  if (items.length === 0) {
    console.log(`No todo items found for ${date}, skipping calendar upload.`);
    return;
  }

  await upsertTodoEvents(items);

  console.log(`Done: ${date}, items=${items.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
