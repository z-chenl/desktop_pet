<script setup lang="ts">
import { ref } from 'vue';
import { useLab } from './useLab.ts';
import TrialPanel from './components/TrialPanel.vue';
import PersonaPanel from './components/PersonaPanel.vue';
import MemoryPanel from './components/MemoryPanel.vue';

const lab = useLab();
const { state, friendId, currentFriend, records, busy, error, notice, hasApi } = lab;
const tab = ref<'trial' | 'persona' | 'memory'>('trial');
const nav = [
  { id: 'trial' as const, label: '试聊与评估', icon: '01' },
  { id: 'persona' as const, label: '调教与发布', icon: '02' },
  { id: 'memory' as const, label: '记忆与交付', icon: '03' },
];
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-mark">橘</span>
        <div><strong>小橘的练习室</strong><span>ORANGE CAT LAB</span></div>
      </div>
      <div class="stage-label">M0 · 离线人格验证</div>
      <nav aria-label="工作台导航">
        <button
          v-for="item in nav"
          :key="item.id"
          :class="{ active: tab === item.id }"
          @click="tab = item.id"
        >
          <span>{{ item.icon }}</span
          >{{ item.label }}<span class="nav-arrow">↗</span>
        </button>
      </nav>
      <div class="sidebar-note">
        <span class="eyebrow">本轮要验证</span>
        <h3>让它有你的语气，<br />也有自己的分寸。</h3>
        <p>先完成文字试聊，再制作正式橘猫形象与桌面动作。</p>
      </div>
      <div class="sidebar-bottom">
        <span class="status-dot"></span>
        <div><strong>本地模型模式</strong><small>无云端回退 · 无 API 密钥</small></div>
      </div>
    </aside>
    <main>
      <header class="page-header">
        <div>
          <div class="eyebrow">PERSONALITY WORKBENCH</div>
          <h1>
            {{
              tab === 'trial'
                ? '先让语气像你。'
                : tab === 'persona'
                  ? '把你的表达，慢慢教给它。'
                  : '同一只橘猫，各自的回忆。'
            }}
          </h1>
          <p>
            {{
              tab === 'trial'
                ? '用熟悉的小场景试聊。你来判断，哪些回应像你。'
                : tab === 'persona'
                  ? '编辑规则和示例，检查后发布一个固定版本。'
                  : '朋友的记忆独立保存；分享的是你确认好的角色版本。'
            }}
          </p>
        </div>
        <span class="phase-badge">开发验证版</span>
      </header>
      <div v-if="!hasApi" class="notice preview-banner">
        界面预览 · 尚未连接桌面主程序。使用 npm run dev 启动后，才能保存数据和连接本机模型。
      </div>
      <div v-if="error" class="notice error" role="alert">{{ error }}</div>
      <div v-if="notice" class="notice success" role="status">{{ notice }}</div>
      <section class="summary-bar" aria-label="当前状态">
        <div>
          <span>已发布原型</span
          ><strong>{{
            state.published ? `v${state.published.persona.revision}` : '尚未发布'
          }}</strong>
        </div>
        <div>
          <span>运行模型</span
          ><strong>{{ state.published?.modelProfile.model ?? '等待选择本地模型' }}</strong>
        </div>
        <div>
          <span>样例来源</span
          ><strong>{{
            state.draft.provenance === 'fictionalSample' ? '虚构示例 · 等你替换' : '创作者提供'
          }}</strong>
        </div>
        <div><span>云端 AI 调用</span><strong class="green">本版本不提供</strong></div>
      </section>
      <div class="section-toolbar">
        <label for="friend-select">正在与谁试聊</label
        ><select id="friend-select" v-model="friendId" :disabled="busy">
          <option v-for="friend in state.friends" :key="friend.id" :value="friend.id">
            {{ friend.name }}
          </option></select
        ><span>共享原型 · 独立记忆</span>
      </div>
      <TrialPanel
        v-if="tab === 'trial'"
        :records="records"
        :scenarios="state.scenarios"
        :busy="busy"
        :can-chat="hasApi && !!state.published"
        :friend-name="currentFriend.name"
        @chat="
          (input, mode) =>
            lab.update((api) => api.chat({ friendId: currentFriend.id, input, mode }))
        "
        @cancel="lab.cancel"
        @rate="(id, rating) => lab.update((api) => api.rate(id, rating))"
        @correct="
          (id, text) =>
            lab.update((api) => api.correct(id, text), '已加入草稿样例。检查并发布新版本后生效。')
        "
        @go-persona="tab = 'persona'"
        @clear="
          lab.update(
            (api) => api.clearConversation(currentFriend.id),
            '已清空当前朋友的试聊记录，保存的记忆保留。',
          )
        "
      />
      <PersonaPanel
        v-else-if="tab === 'persona'"
        :draft="state.draft"
        :published="state.published"
        :busy="busy"
        :has-api="hasApi"
        :run="lab.run"
        @save="
          (draft) => lab.update((api) => api.saveDraft(draft), '草稿已保存，已发布的性格未受影响。')
        "
        @publish="
          (settings) =>
            lab.update(
              (api) => api.publish(settings),
              '新版本已发布，朋友记忆保留；会话上下文已重置。',
            )
        "
      />
      <MemoryPanel
        v-else
        :friend="currentFriend"
        :busy="busy"
        :has-api="hasApi"
        :published="!!state.published"
        :storage-path="state.storagePath"
        @add="
          (text) =>
            lab.update(
              (api) => api.saveMemory({ friendId: currentFriend.id, text }),
              '只保存到当前朋友的记忆。',
            )
        "
        @remove="
          (id) =>
            lab.update(
              (api) => api.deleteMemory(currentFriend.id, id),
              '记忆及该朋友的试聊记录、会话上下文已删除。',
            )
        "
        @add-friend="(name) => lab.update((api) => api.addFriend(name))"
        @export-character="
          lab
            .run((api) => api.exportCharacter())
            .then((path) => {
              if (path) notice = '角色文件已导出，不含朋友的记忆与聊天。';
            })
        "
        @import-character="lab.update((api) => api.importCharacter())"
        @export-evaluation="
          lab
            .run((api) => api.exportEvaluation())
            .then((path) => {
              if (path) notice = '评估记录已导出，其中包含私人对话。';
            })
        "
      />
      <footer class="page-footer">
        <span>形象待你提供参考 · 当前文字与示例均可替换</span
        ><span>手动调教 → 发布版本 → 本机试聊</span>
      </footer>
    </main>
  </div>
</template>
