// ─────────────────────────────────────────────────────
// 공간마켓 라운지 시스템
// ─────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import { MOCK_LOUNGE_POSTS, MOCK_STORIES } from '../constants/lounge';
import {
  IS_SUPABASE_READY,
  getLoungePosts,
  getLoungePost,
  getLoungeStories,
  getLoungeComments,
  createLoungeComment,
  softDeleteLoungeComment,
} from '../lib/supabase';

export function useLounge(category = 'all') {
  const [posts, setPosts]     = useState([]);
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    if (IS_SUPABASE_READY) {
      const [postsRes, storiesRes] = await Promise.all([
        getLoungePosts(category),
        getLoungeStories(),
      ]);
      setPosts(postsRes.data ?? []);
      setStories(storiesRes.data ?? []);
    } else {
      await new Promise(r => setTimeout(r, 200));
      let filtered = [...MOCK_LOUNGE_POSTS];
      if (category === 'popular') {
        filtered = filtered.sort((a, b) =>
          b.view_count !== a.view_count
            ? b.view_count - a.view_count
            : b.like_count - a.like_count
        );
      } else if (category !== 'all') {
        filtered = filtered.filter(p => p.category === category);
      }
      setPosts(filtered);
      setStories(MOCK_STORIES);
    }
    setLoading(false);
  }, [category]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  const likePost = useCallback((postId) => {
    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, like_count: (p.like_count ?? 0) + 1 } : p
    ));
  }, []);

  const addPost = useCallback((newPost) => {
    setPosts(prev => [newPost, ...prev]);
  }, []);

  const removePost = useCallback((postId) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  }, []);

  const updatePost = useCallback((postId, updates) => {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, ...updates } : p));
  }, []);

  const addStory = useCallback((story) => {
    setStories(prev => [story, ...prev]);
  }, []);

  const removeStory = useCallback((storyId) => {
    setStories(prev => prev.filter(s => s.id !== storyId));
  }, []);

  return { posts, stories, loading, likePost, addPost, removePost, updatePost, addStory, removeStory, reload: loadPosts };
}

export function useLoungePost(postId, initialPost = null) {
  const [post, setPost]         = useState(initialPost);
  const [comments, setComments] = useState([]);
  const [loading, setLoading]   = useState(!initialPost);

  useEffect(() => {
    if (!postId) return;
    let cancelled = false;

    const load = async () => {
      if (!initialPost) setLoading(true);
      if (IS_SUPABASE_READY) {
        const [postRes, commentsRes] = await Promise.all([
          getLoungePost(postId),
          getLoungeComments(postId),
        ]);
        if (cancelled) return;
        if (postRes.data) setPost(postRes.data);
        setComments(commentsRes.data ?? []);
      } else {
        await new Promise(r => setTimeout(r, 150));
        if (cancelled) return;
        if (!initialPost) {
          const found = MOCK_LOUNGE_POSTS.find(p => p.id === postId);
          setPost(found ?? null);
        }
        setComments([
          {
            id: 'c1', post_id: postId, parent_id: null,
            anonymous_nickname: '배고픈수달',
            content: '저도 같은 경험 있어요. 이음새 부분만 다시 하는 건 어렵지 않다고 하더라고요.',
            like_count: 5, is_expert_reply: false,
            created_at: new Date(Date.now() - 30 * 60000).toISOString(),
          },
          {
            id: 'c2', post_id: postId, parent_id: null,
            anonymous_nickname: '공간설계사',
            content: '업체 입장에서 말씀드리면, 전체 재작업보다 이음새 보수만 하면 훨씬 저렴합니다. 견적 문의 남겨주시면 도와드릴게요.',
            like_count: 12, is_expert_reply: true,
            created_at: new Date(Date.now() - 20 * 60000).toISOString(),
          },
          {
            id: 'c3', post_id: postId, parent_id: 'c1',
            anonymous_nickname: '날쌘다람쥐',
            content: '감사해요! 보수로 가능한지 여쭤봐야겠네요.',
            like_count: 2, is_expert_reply: false,
            created_at: new Date(Date.now() - 15 * 60000).toISOString(),
          },
        ]);
      }
      if (!cancelled) setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [postId]); // eslint-disable-line react-hooks/exhaustive-deps

  const addComment = useCallback((comment) => {
    setComments(prev => [...prev, comment]);
    setPost(p => p ? { ...p, comment_count: (p.comment_count ?? 0) + 1 } : p);
  }, []);

  const removeComment = useCallback(async (commentId, userId) => {
    if (IS_SUPABASE_READY) {
      await softDeleteLoungeComment(commentId, userId);
    }
    setComments(prev => prev.filter(c => c.id !== commentId));
    setPost(p => p ? { ...p, comment_count: Math.max(0, (p.comment_count ?? 1) - 1) } : p);
  }, []);

  const likeComment = useCallback((commentId) => {
    setComments(prev => prev.map(c =>
      c.id === commentId ? { ...c, like_count: (c.like_count ?? 0) + 1 } : c
    ));
  }, []);

  const updatePostLocal = useCallback((updates) => {
    setPost(p => p ? { ...p, ...updates } : p);
  }, []);

  return { post, comments, loading, addComment, removeComment, likeComment, updatePostLocal };
}
