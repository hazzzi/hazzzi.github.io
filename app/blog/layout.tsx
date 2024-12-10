'use client';
import { Modal } from '@react95/core';
import { IListProps } from '@react95/core/List';
import { Folder } from '@react95/icons';
import { JSXElementConstructor, PropsWithChildren, ReactElement } from 'react';
import { Frame } from '../component/frame';

type Props = {};

// Frame을 명시적으로 ReactElement를 반환하는 컴포넌트로 타입 지정

type List = ReactElement<IListProps, string | JSXElementConstructor<any>>;

const layout = ({ children }: PropsWithChildren<unknown>) => {
  return (
    <section>
      <Modal
        icon={<Folder variant="16x16_4" />}
        title="내 문서"
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
        <Frame
          className="py-4 px-2"
          width="70vw"
          height="50vh"
          bg="white"
          boxShadow="in"
        >
          {children}
        </Frame>
      </Modal>
    </section>
  );
};

export default layout;
