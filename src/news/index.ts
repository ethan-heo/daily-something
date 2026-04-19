import 'dotenv/config';
import { collectNewsLinks, saveNewsLinks } from './run';

async function main(): Promise<void> {
  const { date, items } = await collectNewsLinks();

  if (items.length === 0) {
    console.log(`No news links found for ${date}, skipping calendar upload.`);
    return;
  }

  await saveNewsLinks(date, items);

  console.log(`Done: ${date}, items=${items.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
