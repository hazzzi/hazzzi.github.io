'use client';
import { Frame, Modal } from '@react95/core';
import { IListProps } from '@react95/core/List';
import { Folder, Notepad } from '@react95/icons';
import { Metadata } from 'next';
import {
  ElementType,
  JSXElementConstructor,
  ReactElement,
  useState
} from 'react';
import Footer from './footer';

const metadata: Metadata = {
  title: 'hazzzi.dev — A blog by Hazzzi',
  description: 'My Personal Blog',
};

// Frame을 명시적으로 ReactElement를 반환하는 컴포넌트로 타입 지정
const StyledFrame: ElementType = Frame as unknown as ElementType;
type List = ReactElement<IListProps, string | JSXElementConstructor<any>>;

export default function Home() {
  const [open, setOpen] = useState(false);

  const handleToggle = () => setOpen((open) => !open);

  return (
    <main className="p-8 flex">
      <aside>
        <button className="flex flex-col justify-center items-center p-2">
          <Folder variant="32x32_4" />
          <span className="break-words whitespace-pre-wrap">내 문서</span>
        </button>
      </aside>
      <section className="">
        <Modal
          icon={<Folder variant="16x16_4" />}
          title="My Document"
          menu={[
            { name: 'File', list: [] as unknown as List },
            { name: 'Edit', list: [] as unknown as List },
            { name: 'Help', list: [] as unknown as List },
          ]}
          dragOptions={{
            defaultPosition: {
              x: 60,
              y: 40,
            },
          }}
        >
          <StyledFrame width="70vw" height="50vh" bg="white" boxShadow="in">
            <button
              className="flex flex-col justify-center items-center p-2"
              onClick={handleToggle}
            >
              <Notepad variant="32x32_4" />
              <span className="break-words whitespace-pre-wrap">테스트</span>
            </button>
          </StyledFrame>
        </Modal>
      </section>
      <Footer />
      {open && <Modal title="My Test"></Modal>}
    </main>
  );
}
