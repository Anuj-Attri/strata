import { create } from 'zustand';

export const useStore = create((set) => ({
  modelGraph: null,
  selectedLayerId: null,
  inferenceCache: {},
  isRunning: false,
  layerOrder: [],

  setModelGraph: (modelGraph) => set({ modelGraph }),

  setSelectedLayer: (selectedLayerId) => set({ selectedLayerId }),

  addToCache: (record) =>
    set((state) => ({
      inferenceCache: {
        ...state.inferenceCache,
        [record.layer_id]: record,
      },
    })),

  clearCache: () => set({ inferenceCache: {}, layerOrder: [] }),

  setRunning: (isRunning) => set({ isRunning }),

  setLayerOrder: (layerOrder) => set({ layerOrder }),
}));
