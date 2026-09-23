import assert from 'assert';
import {
  loadBotInstances,
  createBotInstance,
  getBotInstance,
  updateBotInstance,
  updateBotCustomization,
  retriggerBot,
  banBot,
  unbanBot,
  listBots,
  MASTER_BOT_ID
} from '../botManager.js';
import {
  buildConfigPanelPayload,
  buildCredentialsModal,
  buildSupportTextModal,
  buildBannersModal,
  buildAiKeyModal,
  buildAskAiModal,
  TOTAL_PAGES
} from '../configPanel.js';
import { AI_CAPABILITIES, processAiConfigRequest } from '../aiConfigAssistant.js';

console.log("=== RUNNING PLATFORM VERIFICATION TESTS ===");

// 1. Verify Bot Manager
const instances = loadBotInstances();
assert(instances[MASTER_BOT_ID], "Master bot instance must exist");
console.log(`[PASS] Master bot loaded with ID: ${MASTER_BOT_ID}`);

// 2. Create customer bot instance with unique Bot ID
const newBot = createBotInstance("CUSTOMER_123");
assert(newBot.botId.startsWith("LC-"), `Bot ID should start with LC-, got: ${newBot.botId}`);
assert.strictEqual(newBot.setupCompleted, false, "New bot should initially be unconfigured");
console.log(`[PASS] Created customer bot instance with ID: ${newBot.botId}`);

// 3. Test setup completion
updateBotInstance(newBot.botId, {
  token: "TEST_TOKEN_12345",
  erlcApiKey: "TEST_ERLC_API_KEY"
});
const updatedBot = getBotInstance(newBot.botId);
assert.strictEqual(updatedBot.setupCompleted, true, "Bot should be marked setupCompleted after token and API key are set");
assert.strictEqual(updatedBot.status, 'active', "Status should transition to active");
console.log(`[PASS] Setup completion verified for ${newBot.botId}`);

// 4. Test Text Customization
const customText = "If you require support, we ask you to open a ticket and our team will be ready to help. Choose the category that matches your issue below and a private channel will be opened for you. Any trolling or rule violations will result in instant moderation towards your account.";
updateBotCustomization(newBot.botId, 'panelDescription', customText);
const custCheck = getBotInstance(newBot.botId);
assert.strictEqual(custCheck.customizations.panelDescription, customText, "Custom panel description should match exact requested text");
console.log(`[PASS] Custom text update verified`);

// 5. Test Ban, Retrigger, and Unban
const banRes = banBot(newBot.botId, "Terms of service check");
assert.strictEqual(banRes.success, true);
assert.strictEqual(getBotInstance(newBot.botId).banned, true);
console.log(`[PASS] Ban bot verified`);

const retriggerWhileBanned = retriggerBot(newBot.botId);
assert.strictEqual(retriggerWhileBanned.success, false, "Should not retrigger banned bot");
console.log(`[PASS] Retrigger rejection on banned bot verified`);

const unbanRes = unbanBot(newBot.botId);
assert.strictEqual(unbanRes.success, true);
assert.strictEqual(getBotInstance(newBot.botId).banned, false);
console.log(`[PASS] Unban bot verified`);

const retriggerSuccess = retriggerBot(newBot.botId);
assert.strictEqual(retriggerSuccess.success, true, "Retrigger should succeed once unbanned");
console.log(`[PASS] Retrigger bot verified`);

// 6. Test Config Panel Payloads for Pages 1 through 6
for (let p = 1; p <= TOTAL_PAGES; p++) {
  const payload = buildConfigPanelPayload(newBot.botId, p);
  assert.strictEqual(payload.flags, 32768, `Page ${p} must have Components V2 flag 32768`);
  assert.strictEqual(payload.components?.[0]?.type, 17, `Page ${p} must have V2 Container type 17`);
}
console.log(`[PASS] Config panel pages 1 through ${TOTAL_PAGES} generated cleanly in V2 Container format`);

// 7. Test Modals
const credsModal = buildCredentialsModal(newBot.botId);
assert(credsModal.data.title, "Credentials modal must have title");
const textModal = buildSupportTextModal(newBot.botId);
assert(textModal.data.title, "Support text modal must have title");
const bannerModal = buildBannersModal(newBot.botId);
assert(bannerModal.data.title, "Banners modal must have title");
const aiModal = buildAiKeyModal(newBot.botId);
assert(aiModal.data.title, "AI Key modal must have title");
const askAiModal = buildAskAiModal(newBot.botId);
assert(askAiModal.data.title, "Ask AI modal must have title");
console.log(`[PASS] Modals generated successfully`);

// 8. Test AI Capabilities
assert(AI_CAPABILITIES.canDo.length > 5, "Can-do list must be populated");
assert(AI_CAPABILITIES.cannotDo.length >= 5, "Cannot-do security list must be populated");
console.log(`[PASS] AI capabilities matrix validated with ${AI_CAPABILITIES.canDo.length} can-do and ${AI_CAPABILITIES.cannotDo.length} cannot-do rules`);

console.log("\n>>> ALL PLATFORM TESTS PASSED SUCCESSFULLY! <<<");
