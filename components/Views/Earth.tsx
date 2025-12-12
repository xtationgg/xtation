import React, { useEffect } from 'react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src: string;
        alt?: string;
        'camera-controls'?: boolean;
        'auto-rotate'?: boolean;
        autoplay?: boolean;
        exposure?: string | number;
        'shadow-intensity'?: string | number;
        'environment-image'?: string;
        'skybox-image'?: string;
        poster?: string;
      };
    }
  }
}

// Local render of the downloaded Sketchfab Earth model
const defaultModel = '/models/earth.glb';

export const Earth: React.FC = () => {
  const [modelSrc, setModelSrc] = React.useState<string>(defaultModel);
  const [modelLabel, setModelLabel] = React.useState<string>('Local Model Loaded');
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const objectUrlRef = React.useRef<string | null>(null);

  const revokeObjectUrl = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

  const openModelDB = () =>
    new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('EarthModelDB', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('models')) db.createObjectStore('models');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

  const loadPersistedModel = async () => {
    try {
      const db = await openModelDB();
      const tx = db.transaction('models', 'readonly');
      const store = tx.objectStore('models');
      const req = store.get('current');
      req.onsuccess = () => {
        const file = req.result as Blob | undefined;
        if (!file) return;
        revokeObjectUrl();
        const url = URL.createObjectURL(file);
        objectUrlRef.current = url;
        setModelSrc(url);
        setModelLabel(file instanceof File ? file.name : 'Custom Model');
      };
    } catch (err) {
      console.error('Failed to load saved Earth model', err);
    }
  };

  const persistModel = async (file: File) => {
    const db = await openModelDB();
    const tx = db.transaction('models', 'readwrite');
    tx.objectStore('models').put(file, 'current');
  };

  const handleModelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      revokeObjectUrl();
      const url = URL.createObjectURL(file);
      objectUrlRef.current = url;
      setModelSrc(url);
      setModelLabel(file.name);
      await persistModel(file);
    } catch (err) {
      console.error('Failed to load custom model', err);
      setModelSrc(defaultModel);
      setModelLabel('Local Model Loaded');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    if (customElements.get('model-viewer')) return;

    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js';
    document.head.appendChild(script);

    return () => {
      if (!customElements.get('model-viewer') && document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, []);

  useEffect(() => {
    loadPersistedModel();
    return () => revokeObjectUrl();
  }, []);

  return (
    <div className="relative h-full w-full bg-black flex items-center justify-center overflow-hidden">
      <model-viewer
        src={modelSrc}
        alt="3D Earth"
        camera-controls
        auto-rotate
        autoplay
        exposure="1.1"
        shadow-intensity="0.8"
        environment-image="neutral"
        style={{ width: '100%', height: '100%' }}
      />
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <div className="text-[10px] uppercase tracking-[0.2em] bg-black/70 text-white px-3 py-2 border border-white/30">
          {modelLabel}
        </div>
        <div className="flex gap-2 items-center">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-[10px] uppercase tracking-[0.2em] bg-white text-black px-3 py-2 border border-white hover:bg-[#FF2A3A] hover:text-white hover:border-[#FF2A3A] transition-colors"
          >
            Upload Model
          </button>
          <button
            type="button"
            onClick={() => {
              revokeObjectUrl();
              setModelSrc(defaultModel);
              setModelLabel('Local Model Loaded');
              openModelDB().then(db => db.transaction('models', 'readwrite').objectStore('models').delete('current')).catch(() => {});
            }}
            className="text-[10px] uppercase tracking-[0.2em] bg-black/60 text-white px-3 py-2 border border-white/30 hover:border-white"
          >
            Reset
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".glb,.gltf,.usdz,.fbx,.obj,.stl,.dae"
          className="hidden"
          onChange={handleModelUpload}
        />
        <div className="text-[9px] uppercase tracking-[0.2em] text-white/70 bg-black/60 px-2 py-1 border border-white/10">
          Supported: glb, gltf, usdz, fbx, obj, stl, dae
        </div>
      </div>
    </div>
  );
};
