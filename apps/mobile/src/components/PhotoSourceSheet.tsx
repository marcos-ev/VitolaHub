import { ActionSheet } from './ActionSheet';
import { pickImageFrom, PickedImage } from '../lib/pick-image';

interface PhotoSourceSheetProps {
  visible: boolean;
  title?: string;
  onClose: () => void;
  onPicked: (image: PickedImage) => void;
}

export function PhotoSourceSheet({
  visible,
  title = 'Adicionar foto',
  onClose,
  onPicked,
}: PhotoSourceSheetProps) {
  const pick = async (source: 'camera' | 'library') => {
    const image = await pickImageFrom(source);
    if (image) onPicked(image);
  };

  return (
    <ActionSheet
      visible={visible}
      title={title}
      onClose={onClose}
      items={[
        { label: 'Tirar foto', icon: 'camera-outline', onPress: () => void pick('camera') },
        { label: 'Galeria', icon: 'image-outline', onPress: () => void pick('library') },
      ]}
    />
  );
}
