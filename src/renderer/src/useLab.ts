import { computed, onMounted, ref } from 'vue';
import type { LabState, LabApi } from '../../shared/contracts.ts';
import {
  createFictionalSampleDraft,
  createFriendMemoryStore,
  createConversationHistory,
  EVALUATION_SCENARIOS,
} from '../../../packages/persona-core/src/index.ts';

export function useLab() {
  const api = window.orangeCat;
  const draft = createFictionalSampleDraft();
  const state = ref<LabState>({
    draft,
    published: null,
    records: [],
    scenarios: EVALUATION_SCENARIOS,
    storagePath: '',
    friends: ['朋友 A', '朋友 B'].map((name, i) => {
      const id = `preview-${i}`;
      const scope = { personaId: draft.personaId, friendId: id };
      return {
        id,
        name,
        memory: createFriendMemoryStore(scope),
        history: createConversationHistory(scope),
      };
    }),
  });
  const friendId = ref(state.value.friends[0]!.id);
  const busy = ref(false);
  const error = ref('');
  const notice = ref('');
  const currentFriend = computed(
    () => state.value.friends.find((f) => f.id === friendId.value) ?? state.value.friends[0]!,
  );
  const records = computed(() =>
    state.value.records.filter((r) => r.friendId === currentFriend.value.id),
  );
  function requireApi(): LabApi {
    if (!api)
      throw new Error('这是浏览器中的界面预览。请在项目目录运行 npm run dev，打开桌面验证工作台。');
    return api;
  }
  async function run<T>(
    action: (client: LabApi) => Promise<T>,
    success = '',
  ): Promise<T | undefined> {
    if (busy.value) return;
    busy.value = true;
    error.value = '';
    notice.value = '';
    try {
      const result = await action(requireApi());
      if (success) notice.value = success;
      return result;
    } catch (cause) {
      error.value =
        cause instanceof Error
          ? cause.message.replace(/^Error invoking remote method '[^']+': Error: /, '')
          : String(cause);
    } finally {
      busy.value = false;
    }
  }
  async function update(action: (client: LabApi) => Promise<LabState | null>, success = '') {
    const next = await run(action, success);
    if (next) {
      state.value = next;
      if (!next.friends.some((f) => f.id === friendId.value)) friendId.value = next.friends[0]!.id;
    }
  }
  async function cancel() {
    try {
      await requireApi().cancel();
      notice.value = '正在停止本机生成……';
    } catch (cause) {
      error.value = String(cause);
    }
  }
  onMounted(() => {
    if (api) void update((client) => client.getState());
  });
  return {
    state,
    friendId,
    currentFriend,
    records,
    busy,
    error,
    notice,
    hasApi: !!api,
    run,
    update,
    cancel,
  };
}
