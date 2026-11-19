<script setup lang="ts">
import { ref } from 'vue';
import type { FriendProfile } from '../../../shared/contracts.ts';
defineProps<{
  friend: FriendProfile;
  busy: boolean;
  hasApi: boolean;
  published: boolean;
  storagePath: string;
}>();
const emit = defineEmits<{
  add: [text: string];
  remove: [id: string];
  addFriend: [name: string];
  exportCharacter: [];
  importCharacter: [];
  exportEvaluation: [];
}>();
const memory = ref('');
const newFriend = ref('');
const pendingDelete = ref('');
</script>
<template>
  <div class="memory-layout">
    <section class="panel memory-panel">
      <div class="panel-heading">
        <div>
          <span class="eyebrow">PRIVATE MEMORY</span>
          <h2>{{ friend.name }} 的记忆</h2>
        </div>
        <span class="small-badge">{{ friend.memory.entries.length }} 条</span>
      </div>
      <p>这一阶段由你手动确认要记住的内容。聊天不会自动改写性格，也不会自动写入长期记忆。</p>
      <form
        @submit.prevent="
          emit('add', memory);
          memory = '';
        "
      >
        <label
          >新记忆<textarea
            v-model="memory"
            maxlength="600"
            rows="3"
            placeholder="例如：这位朋友点饮料时偏好无糖，也不喜欢咖啡。"
            :disabled="busy"
          ></textarea></label
        ><button class="primary" :disabled="busy || !hasApi || !memory.trim()">
          只记到这个朋友的档案
        </button>
      </form>
      <div v-if="!friend.memory.entries.length" class="empty-memory">
        这里暂时没有记忆。<br /><small>切换朋友后，每个档案会保持独立。</small>
      </div>
      <article v-for="item in friend.memory.entries" :key="item.id" class="memory-card">
        <p>{{ item.text }}</p>
        <div>
          <small>人工保存 · {{ new Date(item.updatedAt).toLocaleDateString() }}</small
          ><button
            class="text-button"
            :disabled="busy"
            @click="pendingDelete = pendingDelete === item.id ? '' : item.id"
          >
            删除
          </button>
        </div>
        <div v-if="pendingDelete === item.id" class="delete-confirm">
          <p>
            删除这条记忆时，也会清空这个朋友的试聊记录和会话上下文，避免旧回复再次带入该内容。你已主动加入角色草稿的样例需在编辑器另行删除。
          </p>
          <button
            class="secondary"
            :disabled="busy"
            @click="
              emit('remove', item.id);
              pendingDelete = '';
            "
          >
            确认删除
          </button>
        </div>
      </article>
      <div class="add-friend">
        <h3>新建独立测试档案</h3>
        <form
          @submit.prevent="
            emit('addFriend', newFriend);
            newFriend = '';
          "
        >
          <input
            v-model="newFriend"
            aria-label="朋友称呼"
            placeholder="朋友称呼"
            maxlength="40"
          /><button class="secondary" :disabled="busy || !hasApi || !newFriend.trim()">新建</button>
        </form>
      </div>
    </section>
    <aside class="delivery-column">
      <section class="panel delivery-panel">
        <span class="eyebrow">CHARACTER PACKAGE</span>
        <h2>分享你调教好的原型</h2>
        <p>角色文件包含已发布的规则、表达样例、版本和模型配置。朋友聊天与记忆不会导出。</p>
        <button
          class="primary wide"
          :disabled="busy || !hasApi || !published"
          @click="emit('exportCharacter')"
        >
          导出角色文件</button
        ><button
          class="secondary wide"
          :disabled="busy || !hasApi"
          @click="emit('importCharacter')"
        >
          导入这个角色的新版本</button
        ><small>当前导出的是角色 JSON，不是最终 EXE / DMG 安装包，也不含模型权重和正式形象。</small>
      </section>
      <section class="panel delivery-panel">
        <span class="eyebrow">LOCAL EVALUATION</span>
        <h2>保留测试结果</h2>
        <p>导出回答、人工评价、修正及运行指标，方便比较下一版。</p>
        <button
          class="secondary wide"
          :disabled="busy || !hasApi"
          @click="emit('exportEvaluation')"
        >
          导出私人评估记录</button
        ><small>评估文件包含私人对话，请只在自己选择的范围内使用。</small>
        <details v-if="storagePath">
          <summary>本地数据位置</summary>
          <p class="file-path">{{ storagePath }}</p>
          <small>本轮使用 SQLite 明文存储；退出应用后可备份数据目录。</small>
        </details>
      </section>
      <div class="quiet-note">
        <h3>未来朋友用起来会怎样？</h3>
        <p>安装程序 → 准备离线模型资源 → 载入你的角色版本 → 开始聊天。</p>
        <p>本轮先验证对话能力，打包计划见 docs/DISTRIBUTION.md。</p>
      </div>
    </aside>
  </div>
</template>
