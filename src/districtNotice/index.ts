import 'dotenv/config';
import { runDistrictNotice } from './run';

runDistrictNotice().catch((error) => {
  console.error(error);
  process.exit(1);
});
