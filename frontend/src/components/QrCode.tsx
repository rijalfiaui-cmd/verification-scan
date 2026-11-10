import { QRCodeCanvas } from 'qrcode.react';

export default function QrCode({ id, value, label }: { id: string; value: string; label: string }) {
  return (
    <QRCodeCanvas
      aria-label={label}
      id={id}
      level="M"
      marginSize={2}
      size={200}
      title={label}
      value={value}
    />
  );
}
