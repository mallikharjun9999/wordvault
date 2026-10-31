// DEVELOPMENT ONLY. Creates ONE clearly-labelled demo account with a few hand-written entries.
// Never touches existing accounts. Refuses to run in production. Safe to rerun (skips if present).
import { connectDb, disconnectDb } from '../src/config/db.js';
import { config } from '../src/config/env.js';
import { User } from '../src/models/index.js';
import { register } from '../src/services/authService.js';
import { createEntry } from '../src/services/vocabularyService.js';
if (config.isProd) { console.error('Refusing to seed in production.'); process.exit(1); }
await connectDb();
const email = 'demo@wordvault.local';
if (await User.findOne({ email })) { console.log('Demo user already exists; nothing to do.'); }
else {
  const user = await register({ email, password: 'demo-password-123', displayName: 'Demo (seed data)' });
  await createEntry(user._id, { word: 'diligent', pronunciation: 'DIL-i-jent', meanings: [{ partOfSpeech: 'adjective', simpleExplanation: 'Working carefully and with steady effort.', teluguMeaning: 'శ్రద్ధగల', teluguExplanation: 'పనిని జాగ్రత్తగా, పట్టుదలతో చేసే వ్యక్తిని సూచిస్తుంది.', examples: [{ en: 'She is a diligent student.', te: 'ఆమె శ్రద్ధగల విద్యార్థిని.', context: 'educational' }] }], synonyms: [{ word: 'hardworking', difference: 'more casual' }], antonyms: ['lazy'], tags: ['seed'] });
  await createEntry(user._id, { word: 'candid', meanings: [{ partOfSpeech: 'adjective', simpleExplanation: 'Honest and direct, even when it is uncomfortable.', teluguMeaning: 'నిష్కపటమైన', examples: [{ en: 'He gave a candid answer.', te: 'అతను నిష్కపటమైన సమాధానం ఇచ్చాడు.', context: 'professional' }] }], synonyms: [{ word: 'frank', difference: '' }], antonyms: ['evasive'], tags: ['seed'] });
  await createEntry(user._id, { word: 'meticulous', meanings: [{ partOfSpeech: 'adjective', simpleExplanation: 'Paying great attention to small details.', teluguMeaning: 'అత్యంత జాగ్రత్తగల', examples: [{ en: 'A meticulous editor checks every comma.', te: '', context: 'professional' }] }], synonyms: [{ word: 'thorough', difference: '' }], antonyms: ['careless'], tags: ['seed'] });
  console.log(`✔ Created demo account ${email} / demo-password-123 with 3 hand-written entries (not AI generated).`);
}
await disconnectDb();
