'use client';
import { Frame } from '@/app/component/frame';
import { Modal, TitleBar } from '@react95/core';
import { Notepad } from '@react95/icons';
import { useRouter } from 'next/navigation';
import { PropsWithChildren } from 'react';

type Props = PropsWithChildren<{
  title: string;
}>;

const ModalLayout = ({ title, children }: Props) => {
  const router = useRouter();
  return (
    <Modal
      icon={<Notepad variant="16x16_4" />}
      title={title}
      titleBarOptions={
        // @ts-ignore
        <TitleBar.OptionsBox>
          <TitleBar.Close onClick={() => router.push('/blog')}>
            X
          </TitleBar.Close>
        </TitleBar.OptionsBox>
      }
      dragOptions={{
        defaultPosition: {
          x: 100,
          y: 10,
        },
      }}
    >
      <Frame
        className="py-4 px-2"
        width="70vw"
        height="70vh"
        bg="white"
        boxShadow="in"
        overflow="auto"
      >
        {children}
      </Frame>
    </Modal>
  );
};

export default ModalLayout;
