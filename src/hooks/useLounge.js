import { useState, useEffect, useCallback } from 'react';
import { getLoungePosts, getLoungeStories, getLoungePost, getLoungeComments, likeLoungePost } from '../lib/supabase';

export function useLounge(category = 'all') {
  const [posts, setPosts]     = useState([]);
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const [postsResult, storiesResult] = await Promise.all([
        getLoungePosts(category),
        getLoungeStories(),
      ]);
      setPosts(postsResult.data ?? []);
      setStories(storiesResult.data ?? []);
    } catch {
      // silent fail — empty state, no mock
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  const likePost = useCallback(async (postId) => {
    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, like_count: (p.like_count ?? 0) + 1 } : p
    ));
    await likeLoungePost(postId);
  }, []);

  const addPost = useCallback((newPost) => {
    setPosts(prev => [newPost, ...prev]);
  }, []);

  return { posts, stories, loading, likePost, addPost, reload: loadPosts };
}

export function useLoungePost(postId) {
  const [post, setPost]         = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!postId) return;
    setLoading(true);
    Promise.all([
      getLoungePost(postId),
      getLoungeComments(postId),
    ]).then(([postResult, commentsResult]) => {
      if (postResult.data) setPost(postResult.data);
      setComments(commentsResult.data ?? []);
    }).catch(() => {
      // silent fail — caller falls back to initialPost
    }).finally(() => setLoading(false));
  }, [postId]);

  const addComment = useCallback((comment) => {
    setComments(prev => [...prev, comment]);
    setPost(p => p ? { ...p, comment_count: (p.comment_count ?? 0) + 1 } : p);
  }, []);

  const likeComment = useCallback((commentId) => {
    setComments(prev => prev.map(c =>
      c.id === commentId ? { ...c, like_count: (c.like_count ?? 0) + 1 } : c
    ));
  }, []);

  return { post, comments, loading, addComment, likeComment, setPost };
}
