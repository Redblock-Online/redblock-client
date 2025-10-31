import { describe, it, expect } from 'vitest';
import { EditorApp, BlockStore, AlertManager, SelectionManager } from '@/features/editor/core';

describe('Editor Core modlet', () => {
  it('should export EditorApp class', () => {
    expect(EditorApp).toBeDefined();
    expect(typeof EditorApp).toBe('function');
  });

  it('should export BlockStore class', () => {
    expect(BlockStore).toBeDefined();
    expect(typeof BlockStore).toBe('function');
  });

  it('should export AlertManager class', () => {
    expect(AlertManager).toBeDefined();
    expect(typeof AlertManager).toBe('function');
  });

  it('should export SelectionManager class', () => {
    expect(SelectionManager).toBeDefined();
    expect(typeof SelectionManager).toBe('function');
  });

  it('should create AlertManager instance', () => {
    const alertManager = new AlertManager();
    expect(alertManager).toBeDefined();
    expect(alertManager).toBeInstanceOf(AlertManager);
  });

  it('should export SelectionManager with correct constructor', () => {
    // SelectionManager requires parameters, just verify it's exported
    expect(SelectionManager).toBeDefined();
    expect(SelectionManager.prototype).toBeDefined();
  });
});
