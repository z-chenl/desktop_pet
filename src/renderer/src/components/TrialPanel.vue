<script setup lang="ts">
import { ref } from 'vue';
import type { EvaluationRecord } from '../../../shared/contracts.ts';
import type { EvaluationScenario } from '../../../../packages/persona-core/src/index.ts';
defineProps<{
  records: EvaluationRecord[];
  scenarios: readonly EvaluationScenario[];
  busy: boolean;
  canChat: boolean;
  friendName: string;
}>();
const emit = defineEmits<{
  chat: [input: string, mode: 'persona' | 'generic'];
  cancel: [];
  rate: [id: string, rating: 'like-me' | 'needs-work'];
  correct: [id: string, text: string];
  goPersona: [];
  clear: [];
}>();
const input = ref('');
const correctionId = ref('');
const correction = ref('');
const sceneNote = ref('');
function choose(scene: EvaluationScenario) {
  input.value = scene.input;
  sceneNote.value = scene.memorySetup.length
    ? `此场景先到“记忆与交付”保存：${scene.memorySetup.map((m) => m.text).join('；')}`
    : scene.checks.join(' · ');
}
function submit(mode: 'persona' | 'generic') {
  if (input.value.trim()) emit('chat', input.value, mode);
}
</script>
<template>
  <div class="trial-layout">
    <section class="panel conversation-panel">
      <div class="panel-heading">
        <div>
          <span class="eyebrow">CONVERSATION</span>
          <h2>与 {{ friendName }} 的试聊</h2>
        </div>
        <button class="text-button" :disabled="busy || !records.length" @click="emit('clear')">
          清空试聊
        </button>
      </div>
      <div class="conversation-body" aria-live="polite">
        <div v-if="!records.length" class="empty-chat">
          <span class="placeholder-badge">形象待定</span>
          <div class="orange-orb">橘</div>
          <h3>一句话，就可以开始。</h3>
          <p>
            先发布一个测试原型，再选个场景试聊。<br />初始样例为虚构内容，并不代表你的真实习惯。
          </p>
          <button v-if="!canChat" class="secondary" @click="emit('goPersona')">
            去调教与发布 ↗
          </button>
        </div>
        <article v-for="record in records.slice(-12)" :key="record.id" class="exchange">
          <div class="user-line">
            <span>你</span>
            <p>{{ record.input }}</p>
          </div>
          <div class="assistant-line">
            <span class="avatar-small">橘</span>
            <div class="reply">
              <div class="reply-caption">
                {{
                  record.mode === 'persona'
                    ? `已发布原型 v${record.personaRevision}`
                    : '通用单轮对照'
                }}
              </div>
              <p>{{ record.output }}</p>
              <div class="reply-meta">
                {{ (record.metrics.wallDurationMs / 1000).toFixed(1) }} 秒<span
                  v-if="record.metrics.tokensPerSecond"
                >
                  · {{ record.metrics.tokensPerSecond.toFixed(1) }} token/s</span
                ><span v-if="record.omittedMemoryCount || record.omittedHistoryTurns">
                  · 部分历史或记忆因上下文预算未带入</span
                >
              </div>
              <div class="rating-row">
                <button
                  :class="{ picked: record.rating === 'like-me' }"
                  :disabled="busy"
                  @click="emit('rate', record.id, 'like-me')"
                >
                  像我</button
                ><button
                  :class="{ picked: record.rating === 'needs-work' }"
                  :disabled="busy"
                  @click="emit('rate', record.id, 'needs-work')"
                >
                  还需要调教</button
                ><button
                  :disabled="busy"
                  @click="
                    correctionId = record.id;
                    correction = record.correction ?? record.output;
                  "
                >
                  我会这样说…
                </button>
              </div>
              <div v-if="correctionId === record.id" class="correction-editor">
                <textarea
                  v-model="correction"
                  aria-label="我的修正回复"
                  maxlength="1800"
                  rows="3"
                ></textarea
                ><button
                  class="secondary"
                  :disabled="busy || !correction.trim()"
                  @click="
                    emit('correct', record.id, correction);
                    correctionId = '';
                  "
                >
                  加入调教草稿</button
                ><small>加入后需你检查、发布；不会自动改写已发布性格。</small>
              </div>
              <p v-if="record.correction" class="saved-correction">
                你的修正：{{ record.correction }}
              </p>
            </div>
          </div>
        </article>
        <p v-if="busy" class="working">正在处理本机任务…</p>
      </div>
      <form class="composer" @submit.prevent="submit('persona')">
        <label class="sr-only" for="chat-input">输入试聊内容</label
        ><textarea
          id="chat-input"
          v-model="input"
          placeholder="比如：今天忙得够呛，回家以后完全不想动。"
          rows="3"
          maxlength="1200"
          :disabled="busy"
          @keydown.ctrl.enter.prevent="submit('persona')"
        ></textarea>
        <div class="composer-actions">
          <span>{{ input.length }} / 1200</span
          ><button
            class="text-button"
            type="button"
            :disabled="!canChat || busy || !input.trim()"
            @click="submit('generic')"
          >
            通用单轮对照</button
          ><button v-if="busy" class="secondary" type="button" @click="emit('cancel')">
            停止生成</button
          ><button v-else class="primary" type="submit" :disabled="!canChat || !input.trim()">
            按发布性格回复 ↗
          </button>
        </div>
      </form>
    </section>
    <aside class="scene-column">
      <section class="panel scene-panel">
        <span class="eyebrow">TRY A SCENARIO</span>
        <h2>从小场景开始</h2>
        <p>同一句话，看看它会如何回应。</p>
        <button
          v-for="(scene, index) in scenarios"
          :key="scene.id"
          class="scene-button"
          :disabled="busy"
          @click="choose(scene)"
        >
          <span>{{ String(index + 1).padStart(2, '0') }}</span
          >{{ scene.title }}<span>↗</span>
        </button>
      </section>
      <div class="quiet-note">
        <h3>怎样判断像不像？</h3>
        <p>
          {{
            sceneNote ||
            '先看用词和句式，再看安慰、拒绝、打趣的方式。挑出不自然的回复，直接改成你会说的话。'
          }}
        </p>
        <p>做通用对照前先清空试聊，保留同一组朋友记忆，可减少历史影响。</p>
        <small>耗时与 token 是本机运行指标，不是云 API 账单。</small>
      </div>
    </aside>
  </div>
</template>
