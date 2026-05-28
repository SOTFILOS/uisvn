import FileUpload from './FileUpload';

interface LandingPageProps {
  onFileSelect: (file: File) => void;
}

export default function LandingPage({ onFileSelect }: LandingPageProps) {
  return (
    <div
      style={{
        minHeight: 'calc(100vh - 64px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ width: '100%', maxWidth: 480 }}>
        <FileUpload onFileSelect={onFileSelect} />
      </div>
    </div>
  );
}
