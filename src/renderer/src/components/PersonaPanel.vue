<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { PersonaDraft } from '../../../../packages/persona-core/src/index.ts';
import type { LocalModel } from '../../../../packages/local-model/types.ts';
import type { CharacterBundle, LabApi, PublishInput } from '../../../shared/contracts.ts';
const props = defineProps<{
  draft: PersonaDraft;
  published: CharacterBundle | null;
  busy: boolean;
  hasApi: boolean;
  run: <T>(action: (client: LabApi) => Promise<T>, success?: string) => Promise<T | undefined>;
}>();
const emit = defineEmits<{ save: [draft: PersonaDraft]; publish: [input: PublishInput] }>();
const clone = (value: PersonaDraft): PersonaDraft => JSON.parse(JSON.stringify(value));
const local = ref(clone(props.draft));
const speakingText = ref(local.value.speakingRules.join('\n'));
const behaviorText = ref(local.value.behaviorRules.join('\n'));
watch(
  () => props.draft,
  (next) => {
    local.value = clone(next);
    speakingText.value = next.speakingRules.join('\n');
    behaviorText.value = next.behaviorRules.join('\n');
  },
);
const composed = computed(() => ({
  ...local.value,
  speakingRules: speakingText.value
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean),
  behaviorRules: behaviorText.value
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean),
}));
const dirty = computed(() => JSON.stringify(composed.value) !== JSON.stringify(props.draft));
const models = ref<LocalModel[]>([]);
const selectedModel = ref(props.published?.modelProfile.model ?? '');
const settings = ref({
  temperature: props.published?.modelProfile.temperature ?? 0.7,
  numCtx: props.published?.modelProfile.numCtx ?? 8192,
  numPredict: props.published?.modelProfile.numPredict ?? 384,
  seed: props.published?.modelProfile.seed ?? 42,
});
async function refreshModels() {
  const next = await props.run((api) => api.listModels());
  if (next) {
    models.value = next;
    if (!next.some((m) => m.name === selectedModel.value))
      selectedModel.value = next[0]?.name ?? '';
  }
}
function addExample() {
  local.value.examples.push({
    id: `example-${Date.now()}`,
    scenario: '',
    user: '',
    assistant: '',
    provenance: 'creatorProvided',
  });
}
function save() {
  emit('save', JSON.parse(JSON.stringify(composed.value)));
}
</script>
<template>
  <div class="persona-layout">
    <section class="panel editor-panel">
      <div class="panel-heading">
        <div>
          <span class="eyebrow">CREATOR DRAFT</span>
          <h2>你的调教草稿</h2>
        </div>
        <span class="small-badge">{{ dirty ? '有未保存修改' : '草稿已同步' }}</span>
      </div>
      <div class="form-grid">
        <label>角色名字<input v-model="local.name" maxlength="80" /></label
        ><label
          >这份原型的来源<select v-model="local.provenance">
            <option value="fictionalSample">虚构开发样例</option>
            <option value="creatorProvided">由我提供并确认</option>
          </select></label
        >
      </div>
      <label
        >性格与身份简介<textarea v-model="local.summary" rows="3" maxlength="1200"></textarea>
      </label>
      <div class="form-grid">
        <label
          >说话规则 <small>每行一条</small
          ><textarea
            v-model="speakingText"
            rows="6"
            placeholder="例如：平常回复两三句；少用感叹号。"
          ></textarea></label
        ><label
          >相处与反应方式 <small>每行一条</small
          ><textarea
            v-model="behaviorText"
            rows="6"
            placeholder="例如：先接住情绪，再给具体建议。"
          ></textarea>
        </label>
      </div>
      <div class="examples-heading">
        <div>
          <h3>“如果是我，我会这样说”</h3>
          <p>只放愿意随角色分享的表达，不放私密聊天原文。</p>
        </div>
        <button class="secondary" :disabled="local.examples.length >= 24" @click="addExample">
          ＋ 增加样例
        </button>
      </div>
      <div v-for="(example, index) in local.examples" :key="example.id" class="example-card">
        <div class="example-label">
          <span
            >样例 {{ String(index + 1).padStart(2, '0') }} ·
            {{ example.provenance === 'fictionalSample' ? '虚构占位' : '创作者提供' }}</span
          ><button class="text-button" @click="local.examples.splice(index, 1)">移除</button>
        </div>
        <label
          >场景<input
            v-model="example.scenario"
            maxlength="240"
            @input="example.provenance = 'creatorProvided'"
        /></label>
        <div class="form-grid">
          <label
            >对方说<textarea
              v-model="example.user"
              maxlength="1200"
              rows="2"
              @input="example.provenance = 'creatorProvided'"
            ></textarea></label
          ><label
            >我会说<textarea
              v-model="example.assistant"
              maxlength="1800"
              rows="2"
              @input="example.provenance = 'creatorProvided'"
            ></textarea>
          </label>
        </div>
      </div>
      <div class="editor-footer">
        <span>保存草稿不会改变朋友正在使用的版本。</span
        ><button class="primary" :disabled="busy || !hasApi || !dirty" @click="save">
          保存草稿
        </button>
      </div>
    </section>
    <aside class="publish-column">
      <section class="panel publish-panel">
        <span class="eyebrow">LOCAL MODEL</span>
        <h2>用本机模型试聊</h2>
        <p>先按 README 安装 Ollama、禁用云服务，并准备本地模型。</p>
        <button class="secondary wide" :disabled="busy || !hasApi" @click="refreshModels">
          检测已安装的本地模型</button
        ><label
          >选择模型<select v-model="selectedModel" :disabled="!models.length || busy">
            <option value="" disabled>尚未检测到模型</option>
            <option v-for="model in models" :key="model.digest" :value="model.name">
              {{ model.name }} · {{ model.quantization }}
            </option>
          </select></label
        >
        <p v-if="models.length" class="model-note">
          只列出通过本地权重校验的模型。发布时记录模型指纹。
        </p>
        <details>
          <summary>本轮运行参数</summary>
          <label
            >温度<input
              v-model.number="settings.temperature"
              type="number"
              min="0"
              max="2"
              step="0.1" /></label
          ><label
            >上下文预算<select v-model.number="settings.numCtx">
              <option :value="4096">4096 tokens</option>
              <option :value="8192">8192 tokens（起点）</option>
            </select></label
          ><label
            >最长回复<input
              v-model.number="settings.numPredict"
              type="number"
              min="32"
              max="1024"
              step="32" /></label
          ><label
            >随机种子<input v-model.number="settings.seed" type="number" min="0" max="2147483647"
          /></label>
        </details>
        <div class="publish-divider"></div>
        <h3>发布 v{{ (published?.persona.revision ?? 0) + 1 }}</h3>
        <p>把当前已保存草稿与模型配置固定下来。朋友记忆保留，会话上下文重新开始。</p>
        <button
          class="primary wide"
          :disabled="busy || !hasApi || dirty || !selectedModel"
          @click="emit('publish', { model: selectedModel, ...settings })"
        >
          发布测试版本</button
        ><small v-if="dirty">先保存草稿，再发布。</small>
      </section>
      <div class="quiet-note">
        <h3>这是调教，不是权重训练。</h3>
        <p>这一阶段通过规则、示例和人工修正影响回复，不做 LoRA，不需要云 API credit。</p>
        <p>对话能否像你，要用真实样例和未见过的场景在你的电脑上验证。</p>
      </div>
    </aside>
  </div>
</template>
