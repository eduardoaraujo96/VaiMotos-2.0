import { useEffect, useRef, useState } from 'react';
import { IonButton, IonIcon } from '@ionic/react';
import { cameraOutline } from 'ionicons/icons';
import { initials } from '../../utils/format';

interface AvatarPickerProps {
  name: string;
  currentUrl?: string;
  onFileChange: (file: File | null) => void;
}

export function AvatarPicker({ name, currentUrl, onFileChange }: AvatarPickerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<string | undefined>(currentUrl);

  useEffect(() => {
    setPreview(currentUrl);
  }, [currentUrl]);

  const handleChange = (file: File | null) => {
    if (preview?.startsWith('blob:')) {
      URL.revokeObjectURL(preview);
    }
    if (!file) {
      setPreview(currentUrl);
      onFileChange(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    onFileChange(file);
  };

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        className="relative h-24 w-24 overflow-hidden rounded-full"
        style={{
          background: 'linear-gradient(135deg, #FF6B00, #FF9A3D)',
          boxShadow: '0 10px 24px rgba(255,107,0,0.28)',
        }}
        onClick={() => inputRef.current?.click()}
      >
        {preview ? (
          <img src={preview} alt="Foto de perfil" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-2xl font-extrabold text-white">
            {initials(name || 'VM')}
          </span>
        )}
        <span
          className="absolute bottom-1 right-1 flex h-7 w-7 items-center justify-center rounded-full"
          style={{ background: '#1A1A2E' }}
        >
          <IonIcon icon={cameraOutline} color="light" />
        </span>
      </button>
      <IonButton fill="clear" size="small" onClick={() => inputRef.current?.click()}>
        {preview ? 'Trocar foto' : 'Adicionar foto'}
      </IonButton>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => handleChange(event.target.files?.[0] ?? null)}
      />
    </div>
  );
}
