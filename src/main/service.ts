import { randomUUID } from 'node:crypto';
import {
  createFictionalSampleDraft,
  parsePersonaDraft,
  publishPersona,
  draftFromSnapshot,
  createFriendMemoryStore,
  upsertFriendMemory,
  deleteFriendMemory,
  createConversationHistory,
  appendConversationTurn,
  buildMessages,
  EVALUATION_SCENARIOS,
} from '../../packages/persona-core/src/index.ts';
import type { PersonaDraft } from '../../packages/persona-core/src/index.ts';
import type { LocalModelClient } from '../../packages/local-model/types.ts';
import type {
  CharacterBundle,
  LabState,
  FriendProfile,
  EvaluationRecord,
  PublishInput,
  ChatInput,
  MemoryInput,
} from '../shared/contracts.ts';
import { parseCharacterBundle, parseModelProfile } from './bundle.ts';
import { DocumentStore } from './store.ts';

export class LabService {
  private active?: AbortController;
  constructor(
    private readonly store: DocumentStore,
    private readonly model: LocalModelClient,
    private readonly storagePath: string,
  ) {
    if (!store.get('settings', 'draft'))
      store.put('settings', 'draft', createFictionalSampleDraft());
    if (!store.list('friends').length) {
      this.addFriend('朋友 A');
      this.addFriend('朋友 B');
    }
  }
  private idle(): void {
    if (this.active) throw new Error('正在生成回复，请先等待完成或点击停止。');
  }
  private getFriend(id: string): FriendProfile {
    if (typeof id !== 'string') throw new Error('请选择朋友。');
    const friend = this.store.get<FriendProfile>('friends', id);
    if (!friend) throw new Error('找不到这个朋友档案。');
    return friend;
  }
  getState(): LabState {
    return {
      draft: parsePersonaDraft(this.store.get('settings', 'draft')),
      published: this.store.get<CharacterBundle>('settings', 'published') ?? null,
      friends: this.store.list<FriendProfile>('friends'),
      records: this.store
        .list<EvaluationRecord>('records')
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      scenarios: EVALUATION_SCENARIOS,
      storagePath: this.storagePath,
    };
  }
  saveDraft(value: PersonaDraft): LabState {
    this.idle();
    const draft = parsePersonaDraft(value);
    const current = this.getState().draft;
    if (draft.personaId !== current.personaId)
      throw new Error('M0 不支持在编辑器中更改角色 ID；请使用导入。');
    this.store.put('settings', 'draft', draft);
    return this.getState();
  }
  listModels() {
    this.idle();
    return this.model.listModels();
  }
  async publish(input: PublishInput): Promise<LabState> {
    this.idle();
    const controller = new AbortController();
    this.active = controller;
    try {
      const found = (await this.model.listModels(controller.signal)).find(
        (m) => m.name === input.model,
      );
      if (!found) throw new Error('请选择已下载且通过本地校验的模型。');
      const modelProfile = parseModelProfile({ ...input, digest: found.digest });
      const state = this.getState();
      const persona = publishPersona(state.draft, {
        revision: (state.published?.persona.revision ?? 0) + 1,
        publishedAt: new Date().toISOString(),
        previous: state.published?.persona,
      });
      const probe = state.friends[0];
      if (!probe) throw new Error('缺少测试朋友档案。');
      // Fail early if fixed rules alone cannot fit; never silently drop the identity.
      buildMessages({
        persona,
        friendId: probe.id,
        memory: createFriendMemoryStore({ personaId: persona.personaId, friendId: probe.id }),
        userInput: '你好。',
        maxPromptChars: Math.floor(modelProfile.numCtx / 2),
      });
      const bundle = parseCharacterBundle({
        format: 'orange-cat-character',
        schemaVersion: 1,
        persona,
        modelProfile,
      });
      this.store.transaction(() => {
        this.store.put('releases', String(persona.revision).padStart(8, '0'), bundle);
        this.store.put('settings', 'published', bundle);
        // Old assistant turns should not pull a newly published persona back to the old style.
        for (const friend of state.friends)
          this.store.put('friends', friend.id, {
            ...friend,
            history: createConversationHistory({
              personaId: persona.personaId,
              friendId: friend.id,
            }),
          });
      });
      return this.getState();
    } finally {
      this.active = undefined;
    }
  }
  addFriend(name: string): LabState {
    this.idle();
    if (typeof name !== 'string' || !name.trim() || name.length > 40)
      throw new Error('朋友称呼请输入 1–40 个字符。');
    if (this.store.list('friends').length >= 12) throw new Error('M0 最多建立 12 个测试朋友。');
    const id = randomUUID();
    const personaId = parsePersonaDraft(this.store.get('settings', 'draft')).personaId;
    const scope = { personaId, friendId: id };
    this.store.put('friends', id, {
      id,
      name: name.trim(),
      memory: createFriendMemoryStore(scope),
      history: createConversationHistory(scope),
    });
    return this.getState();
  }
  async chat(input: ChatInput): Promise<LabState> {
    this.idle();
    if (!input || (input.mode !== 'persona' && input.mode !== 'generic'))
      throw new Error('请选择人格试聊或通用对照。');
    if (typeof input.input !== 'string' || !input.input.trim() || input.input.length > 1200)
      throw new Error('试聊内容请输入 1–1200 个字符。');
    const friend = this.getFriend(input.friendId);
    const bundle = this.store.get<CharacterBundle>('settings', 'published');
    if (!bundle) throw new Error('请先在“调教与发布”选择本地模型，发布一个测试版本。');
    const checked = parseCharacterBundle(bundle);
    const prompt = buildMessages({
      persona: checked.persona,
      friendId: friend.id,
      memory: friend.memory,
      history:
        input.mode === 'persona'
          ? friend.history
          : createConversationHistory({
              personaId: checked.persona.personaId,
              friendId: friend.id,
            }),
      userInput: input.input,
      mode: input.mode,
      maxPromptChars: Math.floor(checked.modelProfile.numCtx / 2),
    });
    const controller = new AbortController();
    this.active = controller;
    try {
      const profile = checked.modelProfile;
      const result = await this.model.chat(
        prompt.messages,
        profile.model,
        {
          temperature: profile.temperature,
          numCtx: profile.numCtx,
          numPredict: profile.numPredict,
          seed: profile.seed,
          expectedDigest: profile.digest,
        },
        controller.signal,
      );
      if (controller.signal.aborted) throw new Error('已停止生成，没有写入本轮聊天。');
      const record: EvaluationRecord = {
        id: randomUUID(),
        friendId: friend.id,
        personaRevision: checked.persona.revision,
        model: result.model,
        digest: result.digest,
        mode: input.mode,
        input: input.input,
        output: result.content,
        createdAt: new Date().toISOString(),
        metrics: result.metrics,
        selectedMemoryIds: prompt.selectedMemoryIds,
        omittedHistoryTurns: prompt.omittedHistoryTurns,
        omittedMemoryCount: prompt.omittedMemoryCount,
      };
      this.store.transaction(() => {
        this.store.put('records', record.id, record);
        if (input.mode === 'persona') {
          const scope = { personaId: checked.persona.personaId, friendId: friend.id };
          const history = appendConversationTurn(
            appendConversationTurn(friend.history, scope, { role: 'user', content: input.input }),
            scope,
            { role: 'assistant', content: result.content },
          );
          this.store.put('friends', friend.id, { ...friend, history });
        }
      });
      return this.getState();
    } finally {
      this.active = undefined;
    }
  }
  cancel(): void {
    this.active?.abort();
  }
  saveMemory(input: MemoryInput): LabState {
    this.idle();
    const friend = this.getFriend(input.friendId);
    const scope = { personaId: friend.memory.personaId, friendId: friend.id };
    const memory = upsertFriendMemory(
      friend.memory,
      scope,
      { id: input.id ?? randomUUID(), category: 'fact', text: input.text },
      new Date().toISOString(),
    );
    this.store.put('friends', friend.id, { ...friend, memory });
    return this.getState();
  }
  deleteMemory(friendId: string, memoryId: string): LabState {
    this.idle();
    const friend = this.getFriend(friendId);
    const scope = { personaId: friend.memory.personaId, friendId };
    const memory = deleteFriendMemory(friend.memory, scope, memoryId);
    this.store.transaction(() => {
      this.store.put('friends', friend.id, {
        ...friend,
        memory,
        history: createConversationHistory(scope),
      });
      // M0 has no derived embeddings. Drop evaluations for this friend too, since replies may quote the memory.
      this.store.deleteWhere(
        'records',
        (record: EvaluationRecord) => record.friendId === friend.id,
      );
    });
    return this.getState();
  }
  clearConversation(friendId: string): LabState {
    this.idle();
    const friend = this.getFriend(friendId);
    this.store.transaction(() => {
      this.store.put('friends', friend.id, {
        ...friend,
        history: createConversationHistory({ personaId: friend.memory.personaId, friendId }),
      });
      this.store.deleteWhere(
        'records',
        (record: EvaluationRecord) => record.friendId === friend.id,
      );
    });
    return this.getState();
  }
  rate(id: string, rating: 'like-me' | 'needs-work'): LabState {
    this.idle();
    if (!['like-me', 'needs-work'].includes(rating)) throw new Error('请选择有效的评价。');
    const record = this.store.get<EvaluationRecord>('records', id);
    if (!record) throw new Error('找不到这次试聊。');
    this.store.put('records', id, { ...record, rating });
    return this.getState();
  }
  correct(id: string, text: string): LabState {
    this.idle();
    if (typeof text !== 'string' || !text.trim() || text.length > 1800)
      throw new Error('修正内容请输入 1–1800 个字符。');
    const record = this.store.get<EvaluationRecord>('records', id);
    if (!record) throw new Error('找不到这次试聊。');
    const draft = this.getState().draft;
    const example = {
      id: `correction-${id}`,
      scenario: '创作者人工修正试聊回复',
      user: record.input,
      assistant: text,
      provenance: 'creatorProvided' as const,
    };
    const examples = [...draft.examples.filter((e) => e.id !== example.id), example];
    const checked = parsePersonaDraft({ ...draft, examples });
    this.store.transaction(() => {
      this.store.put('settings', 'draft', checked);
      this.store.put('records', id, { ...record, rating: 'needs-work', correction: text });
    });
    return this.getState();
  }
  importCharacter(value: unknown): LabState {
    this.idle();
    const bundle = parseCharacterBundle(value);
    const state = this.getState();
    if (state.draft.personaId !== bundle.persona.personaId)
      throw new Error('M0 仅支持导入同一角色的版本；其他角色请使用独立工作目录。');
    if (state.published && bundle.persona.revision <= state.published.persona.revision)
      throw new Error('导入版本必须高于本机已发布版本，避免无意降级或覆盖。');
    this.store.transaction(() => {
      this.store.put('settings', 'published', bundle);
      this.store.put('settings', 'draft', draftFromSnapshot(bundle.persona));
      this.store.put('releases', String(bundle.persona.revision).padStart(8, '0'), bundle);
      for (const friend of state.friends)
        this.store.put('friends', friend.id, {
          ...friend,
          history: createConversationHistory({
            personaId: bundle.persona.personaId,
            friendId: friend.id,
          }),
        });
    });
    return this.getState();
  }
}
