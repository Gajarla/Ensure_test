import { sample } from 'lodash';
// utils
import mockData from '../utils/mock-data';

// ----------------------------------------------------------------------

export const getPosts = async () => {
  const posts = [...Array(3)].map((_, index) => ({
    id: mockData.id(index),
    author: {
      id: mockData.id(8),
      avatarUrl: mockData.image.avatar(1),
      name: 'Caitlyn Kerluke'
    },
    isLiked: true,
    createdAt: mockData.time(index),
    media: mockData.image.feed(index),
    message: mockData?.text.sentence(index),
    personLikes: [...Array(36)].map((_, index) => ({
      name: mockData.name.fullName(index),
      avatarUrl: mockData.image.avatar(index + 2)
    })),
    comments: (index === 2 && []) || [
      {
        id: mockData.id(7),
        author: {
          id: mockData.id(8),
          avatarUrl: mockData.image.avatar(sample([2, 3, 4, 5, 6]) || 2),
          name: mockData.name.fullName(index + 5)
        },
        createdAt: mockData.time(2),
        message: 'Praesent venenatis metus at'
      },
      {
        id: mockData.id(9),
        author: {
          id: mockData.id(10),
          avatarUrl: mockData.image.avatar(sample([7, 8, 9, 10, 11]) || 7),
          name: mockData.name.fullName(index + 6)
        },
        createdAt: mockData.time(3),
        message:
          'Etiam rhoncus. Nullam vel sem. Pellentesque libero tortor, tincidunt et, tincidunt eget, semper nec, quam. Sed lectus.'
      }
    ]
  }));

  return posts;
};

// ----------------------------------------------------------------------

export default { getPosts };
