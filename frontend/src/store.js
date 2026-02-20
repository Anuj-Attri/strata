import { create } from 'zustand';

export const useStore = create((set) => ({
  modelGraph: null,
  selectedLayerId: null,
  inferenceCache: {},
  isRunning: false,
  layerOrder: [],
  fullRender: false,

  setModelGraph: (modelGraph) => set({ modelGraph }),
  setFullRender: (fullRender) => set({ fullRender }),

  setSelectedLayer: (selectedLayerId) => set({ selectedLayerId }),

  addToCache: (key, record) =>
    set((state) => ({
      inferenceCache: {
        ...state.inferenceCache,
        [key]: record,
      },
    })),

  addToCacheBatch: (batch) =>
    set((state) => ({
      inferenceCache: {
        ...state.inferenceCache,
        ...batch,
      },
    })),

  clearCache: () => set({ inferenceCache: {}, layerOrder: [] }),

  setRunning: (isRunning) => set({ isRunning }),

  setLayerOrder: (layerOrder) => set({ layerOrder }),
}));
