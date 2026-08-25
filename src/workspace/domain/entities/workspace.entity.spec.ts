import { Workspace } from './workspace.entity';

describe('Workspace', () => {
  const id = 'workspace-123';
  const name = 'Backend Development Team';
  const slug = 'backend-development';
  const owner = 'user-123';

  describe('constructor', () => {
    it('should create a workspace with the provided values', () => {
      const createdAt = new Date('2026-08-18T10:00:00.000Z');
      const updatedAt = new Date('2026-08-18T11:00:00.000Z');

      const workspace = new Workspace(
        id,
        name,
        slug,
        owner,
        createdAt,
        updatedAt,
      );

      expect(workspace).toBeInstanceOf(Workspace);

      expect(workspace.id).toBe(id);
      expect(workspace.name).toBe(name);
      expect(workspace.slug).toBe(slug);
      expect(workspace.owner).toBe(owner);
      expect(workspace.createdAt).toBe(createdAt);
      expect(workspace.updatedAt).toBe(updatedAt);
    });

    it('should allow createdAt and updatedAt to be omitted', () => {
      const workspace = new Workspace(id, name, slug, owner);

      expect(workspace).toBeInstanceOf(Workspace);

      expect(workspace.id).toBe(id);
      expect(workspace.name).toBe(name);
      expect(workspace.slug).toBe(slug);
      expect(workspace.owner).toBe(owner);
      expect(workspace.createdAt).toBeUndefined();
      expect(workspace.updatedAt).toBeUndefined();
    });

    it('should preserve the exact values provided to the constructor', () => {
      const workspace = new Workspace(
        'workspace-456',
        'My Workspace',
        'my-workspace',
        'user-456',
      );

      expect(workspace).toEqual(
        new Workspace(
          'workspace-456',
          'My Workspace',
          'my-workspace',
          'user-456',
        ),
      );
    });
  });
});
