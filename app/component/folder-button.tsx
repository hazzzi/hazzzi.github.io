'use client';
import { Folder } from '@react95/icons';
import { useRouter } from 'next/navigation';

const FolderButton = () => {
  const router = useRouter();

  return (
    <button
      className="flex flex-col justify-center items-center p-2"
      onClick={() => router.push('/blog')}
    >
      <Folder variant="32x32_4" />
      <span className="break-words whitespace-pre-wrap">내 문서</span>
    </button>
  );
};

export default FolderButton;
