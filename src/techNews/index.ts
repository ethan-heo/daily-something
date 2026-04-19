import 'dotenv/config';
import { collectNews, saveNews } from './run';

async function main(): Promise<void> {
  const { date, items } = await collectNews();

  if (items.length === 0) {
    console.log(`No tech news items found for ${date}, skipping calendar upload.`);
    return;
  }

  await saveNews(date, items);

  console.log(`Done: ${date}, items=${items.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
