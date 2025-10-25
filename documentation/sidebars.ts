import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */
const sidebars: SidebarsConfig = {
  // Documentation sidebar
  tutorialSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Architecture',
      items: ['architecture/overview'],
    },
    {
      type: 'category',
      label: 'Core Concepts',
      items: [
        'core-concepts/app',
        'core-concepts/editor-app',
        'core-concepts/game-loop',
      ],
    },
    {
      type: 'category',
      label: 'Systems',
      items: [
        'systems/physics',
        'systems/audio',
        'systems/target-manager',
        'systems/networking',
      ],
    },
    {
      type: 'category',
      label: 'Editor',
      items: [
        'editor/getting-started',
        'editor/generators',
        'editor/events',
        'editor/components',
      ],
    },
    {
      type: 'category',
      label: 'Performance',
      items: [
        'performance/optimization',
        'performance/best-practices',
      ],
    },
  ],

  // API Reference sidebar
  apiSidebar: [
    {
      type: 'category',
      label: 'API Reference',
      items: [
        'api/app',
        'api/editor-app',
        'api/physics-system',
        'api/audio-manager',
        'api/target-manager',
      ],
    },
  ],
};

export default sidebars;
