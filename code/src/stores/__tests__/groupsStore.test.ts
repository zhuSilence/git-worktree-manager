import { describe, it, expect, beforeEach } from 'vitest';
import { useGroupsStore } from '../groupsStore';

describe('useGroupsStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useGroupsStore.setState({
      groups: [],
      groupings: [],
      autoGroupRules: [],
      initialized: false,
    });
  });

  describe('initial state', () => {
    it('should have correct initial values', () => {
      const state = useGroupsStore.getState();
      expect(state.groups).toEqual([]);
      expect(state.groupings).toEqual([]);
      expect(state.autoGroupRules).toEqual([]);
      expect(state.initialized).toBe(false);
    });
  });

  describe('createGroup', () => {
    it('should create a new group', () => {
      const store = useGroupsStore.getState();
      const group = store.createGroup('功能开发', '#3b82f6', '功能开发相关');

      expect(group.name).toBe('功能开发');
      expect(group.color).toBe('#3b82f6');
      expect(group.description).toBe('功能开发相关');
      expect(group.id).toBeDefined();
      expect(group.order).toBe(0);

      const state = useGroupsStore.getState();
      expect(state.groups).toHaveLength(1);
      expect(state.groups[0]).toEqual(group);
    });

    it('should create group without description', () => {
      const store = useGroupsStore.getState();
      const group = store.createGroup('Bug修复', '#ef4444');

      expect(group.name).toBe('Bug修复');
      expect(group.description).toBeUndefined();
    });

    it('should assign correct order for multiple groups', () => {
      const store = useGroupsStore.getState();
      
      store.createGroup('Group 1', '#3b82f6');
      store.createGroup('Group 2', '#10b981');
      store.createGroup('Group 3', '#f59e0b');

      const state = useGroupsStore.getState();
      expect(state.groups[0].order).toBe(0);
      expect(state.groups[1].order).toBe(1);
      expect(state.groups[2].order).toBe(2);
    });
  });

  describe('updateGroup', () => {
    it('should update group properties', () => {
      const store = useGroupsStore.getState();
      const group = store.createGroup('Original', '#3b82f6');

      store.updateGroup(group.id, { name: 'Updated', color: '#ef4444' });

      const state = useGroupsStore.getState();
      expect(state.groups[0].name).toBe('Updated');
      expect(state.groups[0].color).toBe('#ef4444');
      expect(state.groups[0].updatedAt).toBeDefined();
    });

    it('should not modify other groups', () => {
      const store = useGroupsStore.getState();
      const group1 = store.createGroup('Group 1', '#3b82f6');
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const group2 = store.createGroup('Group 2', '#10b981');

      store.updateGroup(group1.id, { name: 'Updated Group 1' });

      const state = useGroupsStore.getState();
      expect(state.groups[0].name).toBe('Updated Group 1');
      expect(state.groups[1].name).toBe('Group 2');
    });
  });

  describe('deleteGroup', () => {
    it('should remove group from list', () => {
      const store = useGroupsStore.getState();
      const group = store.createGroup('Test Group', '#3b82f6');

      store.deleteGroup(group.id);

      const state = useGroupsStore.getState();
      expect(state.groups).toHaveLength(0);
    });

    it('should clear groupings for deleted group', () => {
      const store = useGroupsStore.getState();
      const group = store.createGroup('Test Group', '#3b82f6');

      // Set a worktree to this group
      store.setWorktreeGroup('/test/repo', 'worktree-1', group.id);

      expect(useGroupsStore.getState().groupings).toHaveLength(1);

      // Delete the group
      store.deleteGroup(group.id);

      const state = useGroupsStore.getState();
      // Grouping should have groupId set to null
      expect(state.groupings[0].groupId).toBeNull();
    });
  });

  describe('reorderGroups', () => {
    it('should reorder groups based on provided order', () => {
      const store = useGroupsStore.getState();
      const group1 = store.createGroup('Group 1', '#3b82f6');
      const group2 = store.createGroup('Group 2', '#10b981');
      const group3 = store.createGroup('Group 3', '#f59e0b');

      // Reorder: 3, 1, 2
      store.reorderGroups([group3.id, group1.id, group2.id]);

      const state = useGroupsStore.getState();
      expect(state.groups[0].id).toBe(group3.id);
      expect(state.groups[1].id).toBe(group1.id);
      expect(state.groups[2].id).toBe(group2.id);
    });
  });

  describe('setWorktreeGroup', () => {
    it('should set worktree group', () => {
      const store = useGroupsStore.getState();
      const group = store.createGroup('Test Group', '#3b82f6');

      store.setWorktreeGroup('/test/repo', 'worktree-1', group.id);

      const state = useGroupsStore.getState();
      expect(state.groupings).toHaveLength(1);
      expect(state.groupings[0]).toEqual({
        repoPath: '/test/repo',
        worktreeId: 'worktree-1',
        groupId: group.id,
      });
    });

    it('should update existing grouping', () => {
      const store = useGroupsStore.getState();
      const group1 = store.createGroup('Group 1', '#3b82f6');
      const group2 = store.createGroup('Group 2', '#10b981');

      store.setWorktreeGroup('/test/repo', 'worktree-1', group1.id);
      store.setWorktreeGroup('/test/repo', 'worktree-1', group2.id);

      const state = useGroupsStore.getState();
      expect(state.groupings).toHaveLength(1);
      expect(state.groupings[0].groupId).toBe(group2.id);
    });

    it('should allow setting group to null (ungrouped)', () => {
      const store = useGroupsStore.getState();
      const group = store.createGroup('Test Group', '#3b82f6');

      store.setWorktreeGroup('/test/repo', 'worktree-1', group.id);
      store.setWorktreeGroup('/test/repo', 'worktree-1', null);

      const state = useGroupsStore.getState();
      expect(state.groupings[0].groupId).toBeNull();
    });
  });

  describe('getWorktreeGroup', () => {
    it('should return the group for a worktree', () => {
      const store = useGroupsStore.getState();
      const group = store.createGroup('Test Group', '#3b82f6');

      store.setWorktreeGroup('/test/repo', 'worktree-1', group.id);

      const result = store.getWorktreeGroup('/test/repo', 'worktree-1');
      expect(result).toEqual(group);
    });

    it('should return null for ungrouped worktree', () => {
      const store = useGroupsStore.getState();
      const result = store.getWorktreeGroup('/test/repo', 'worktree-1');
      expect(result).toBeNull();
    });

    it('should return null when groupId is null in grouping', () => {
      const store = useGroupsStore.getState();
      store.setWorktreeGroup('/test/repo', 'worktree-1', null);

      const result = store.getWorktreeGroup('/test/repo', 'worktree-1');
      expect(result).toBeNull();
    });
  });

  describe('getGroupWorktrees', () => {
    it('should return worktree IDs for a group', () => {
      const store = useGroupsStore.getState();
      const group = store.createGroup('Test Group', '#3b82f6');

      store.setWorktreeGroup('/test/repo', 'worktree-1', group.id);
      store.setWorktreeGroup('/test/repo', 'worktree-2', group.id);
      store.setWorktreeGroup('/test/repo', 'worktree-3', null); // Ungrouped

      const result = store.getGroupWorktrees('/test/repo', group.id);
      expect(result).toEqual(['worktree-1', 'worktree-2']);
    });

    it('should return empty array for non-existent group', () => {
      const store = useGroupsStore.getState();
      const result = store.getGroupWorktrees('/test/repo', 'non-existent');
      expect(result).toEqual([]);
    });
  });

  describe('getUngroupedWorktrees', () => {
    it('should return worktree IDs that are not grouped', () => {
      const store = useGroupsStore.getState();
      const group = store.createGroup('Test Group', '#3b82f6');

      store.setWorktreeGroup('/test/repo', 'worktree-1', group.id);
      // worktree-2 and worktree-3 are not grouped

      const result = store.getUngroupedWorktrees('/test/repo', ['worktree-1', 'worktree-2', 'worktree-3']);
      expect(result).toEqual(['worktree-2', 'worktree-3']);
    });
  });

  describe('addAutoGroupRule', () => {
    it('should add a new auto group rule', () => {
      const store = useGroupsStore.getState();
      const group = store.createGroup('Feature', '#3b82f6');

      const rule = store.addAutoGroupRule({
        name: 'Feature branches',
        pattern: '^feature/',
        targetGroupId: group.id,
        enabled: true,
      });

      expect(rule.id).toBeDefined();
      expect(rule.name).toBe('Feature branches');
      expect(rule.pattern).toBe('^feature/');
      expect(rule.targetGroupId).toBe(group.id);
      expect(rule.enabled).toBe(true);

      const state = useGroupsStore.getState();
      expect(state.autoGroupRules).toHaveLength(1);
    });
  });

  describe('updateAutoGroupRule', () => {
    it('should update an existing rule', () => {
      const store = useGroupsStore.getState();
      const group = store.createGroup('Feature', '#3b82f6');

      const rule = store.addAutoGroupRule({
        name: 'Feature branches',
        pattern: '^feature/',
        targetGroupId: group.id,
        enabled: true,
      });

      store.updateAutoGroupRule(rule.id, { enabled: false, pattern: '^feat/' });

      const state = useGroupsStore.getState();
      expect(state.autoGroupRules[0].enabled).toBe(false);
      expect(state.autoGroupRules[0].pattern).toBe('^feat/');
    });
  });

  describe('deleteAutoGroupRule', () => {
    it('should delete a rule', () => {
      const store = useGroupsStore.getState();
      const group = store.createGroup('Feature', '#3b82f6');

      const rule = store.addAutoGroupRule({
        name: 'Feature branches',
        pattern: '^feature/',
        targetGroupId: group.id,
        enabled: true,
      });

      store.deleteAutoGroupRule(rule.id);

      const state = useGroupsStore.getState();
      expect(state.autoGroupRules).toHaveLength(0);
    });
  });

  describe('applyAutoGrouping', () => {
    it('should apply matching rule to worktree', () => {
      const store = useGroupsStore.getState();
      const group = store.createGroup('Feature', '#3b82f6');

      store.addAutoGroupRule({
        name: 'Feature branches',
        pattern: '^feature/',
        targetGroupId: group.id,
        enabled: true,
      });

      const result = store.applyAutoGrouping('/test/repo', 'worktree-1', 'feature/new-feature');

      expect(result).toBe(group.id);
      const state = useGroupsStore.getState();
      const grouping = state.groupings.find(
        g => g.repoPath === '/test/repo' && g.worktreeId === 'worktree-1'
      );
      expect(grouping?.groupId).toBe(group.id);
    });

    it('should return null when no rule matches', () => {
      const store = useGroupsStore.getState();
      const group = store.createGroup('Feature', '#3b82f6');

      store.addAutoGroupRule({
        name: 'Feature branches',
        pattern: '^feature/',
        targetGroupId: group.id,
        enabled: true,
      });

      const result = store.applyAutoGrouping('/test/repo', 'worktree-1', 'bugfix/some-bug');

      expect(result).toBeNull();
    });

    it('should not apply disabled rules', () => {
      const store = useGroupsStore.getState();
      const group = store.createGroup('Feature', '#3b82f6');

      store.addAutoGroupRule({
        name: 'Feature branches',
        pattern: '^feature/',
        targetGroupId: group.id,
        enabled: false, // Disabled
      });

      const result = store.applyAutoGrouping('/test/repo', 'worktree-1', 'feature/new-feature');

      expect(result).toBeNull();
    });

    it('should handle invalid regex patterns gracefully', () => {
      const store = useGroupsStore.getState();
      const group = store.createGroup('Feature', '#3b82f6');

      store.addAutoGroupRule({
        name: 'Invalid pattern',
        pattern: '[invalid(', // Invalid regex
        targetGroupId: group.id,
        enabled: true,
      });

      // Should not throw, just return null
      const result = store.applyAutoGrouping('/test/repo', 'worktree-1', 'feature/new-feature');

      expect(result).toBeNull();
    });
  });

  describe('initializeDefaultGroups', () => {
    it('should initialize default groups when empty', () => {
      const store = useGroupsStore.getState();
      store.initializeDefaultGroups();

      const state = useGroupsStore.getState();
      expect(state.groups.length).toBe(4); // DEFAULT_GROUPS has 4 items
      expect(state.initialized).toBe(true);
    });

    it('should not reinitialize if already initialized', () => {
      const store = useGroupsStore.getState();
      store.initializeDefaultGroups();
      
      // Add a custom group
      store.createGroup('Custom', '#000000');

      const groupsCount = useGroupsStore.getState().groups.length;

      // Try to initialize again
      store.initializeDefaultGroups();

      // Groups should not change
      expect(useGroupsStore.getState().groups.length).toBe(groupsCount);
    });

    it('should not initialize if groups already exist', () => {
      const store = useGroupsStore.getState();
      store.createGroup('Existing', '#3b82f6');

      store.initializeDefaultGroups();

      const state = useGroupsStore.getState();
      // Should only have the existing group, not default groups
      expect(state.groups.length).toBe(1);
      expect(state.groups[0].name).toBe('Existing');
      expect(state.initialized).toBe(false);
    });
  });

  describe('clearRepoGroupings', () => {
    it('should clear all groupings for a repository', () => {
      const store = useGroupsStore.getState();
      const group = store.createGroup('Test Group', '#3b82f6');

      store.setWorktreeGroup('/test/repo1', 'worktree-1', group.id);
      store.setWorktreeGroup('/test/repo1', 'worktree-2', group.id);
      store.setWorktreeGroup('/test/repo2', 'worktree-3', group.id);

      store.clearRepoGroupings('/test/repo1');

      const state = useGroupsStore.getState();
      expect(state.groupings).toHaveLength(1);
      expect(state.groupings[0].repoPath).toBe('/test/repo2');
    });
  });
});
