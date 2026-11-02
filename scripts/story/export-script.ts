/**
 * Writes docs/STORY_SCRIPT_COMPLETE.md from the campaign data (src/story/*.ts).
 * Run after any change to the story: `npm run story:script`.
 * tests/unit/storyComplete.test.ts fails if the document is out of date.
 */
import { writeFileSync } from 'node:fs';
import { storyScriptMarkdown } from '../../src/story/scriptDoc';

writeFileSync('docs/STORY_SCRIPT_COMPLETE.md', storyScriptMarkdown());
console.log('Wrote docs/STORY_SCRIPT_COMPLETE.md');
