import 'dotenv/config';
import { collectNews, saveNews } from './run';

async function main(): Promise<void> {
  const collections = await collectNews();

  for (const { date, items } of collections) {
    if (items.length === 0) {
      console.log(`No tech news items found for ${date}, skipping calendar upload.`);
      continue;
    }

    await saveNews(date, items);

    console.log(`Done: ${date}, items=${items.length}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
