import { Notepad } from '@react95/icons';
import Link from 'next/link';
import { formatDate, getBlogPosts } from './utils';

const page = () => {
  const allBlogs = getBlogPosts();

  return (
    <section className='flex gap-1'>
      {allBlogs
        .sort((a, b) => {
          if (
            new Date(a.metadata.publishedAt) > new Date(b.metadata.publishedAt)
          ) {
            return -1;
          }
          return 1;
        })
        .map((post) => (
          <Link
            key={post.slug}
            className="flex flex-col justify-start items-center max-w-32 text-center gap-1"
            href={`/blog/${post.slug}`}
          >
            <Notepad variant="32x32_4" />
            <p className="text-neutral-600 dark:text-neutral-400 tabular-nums">
              {formatDate(post.metadata.publishedAt, false)}
            </p>
            <span className="break-words whitespace-pre-wrap">
              {post.metadata.title}
            </span>
          </Link>
        ))}
    </section>
  );
};

export default page;
