import { useState, useEffect, useCallback } from 'react';
import { getLoungePosts, getLoungeStories, getLoungePost, getLoungeComments, likeLoungePost } from '../lib/supabase';

export function useLounge(category = 'all') {
  const [posts,       setPosts]       = useState([]);
  const [stories,     setStories]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [fetchError,  setFetchError]  = useState(null);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    const [postsResult, storiesResult] = await Promise.all([
      getLoungePosts(category),
      getLoungeStories(),
    ]);
    if (postsResult.error) {
      setFetchError(postsResult.error.message);
      setPosts([]);
    } else {
      setPosts(postsResult.data ?? []);
    }
    if (!storiesResult.error) {
      const now = Date.now();
      // client-side expiry filter (story_expires_at may not exist in older schemas)
      const active = (storiesResult.data ?? []).filter(s => {
        if (!s.story_expires_at) return true;
        return new Date(s.story_expires_at).getTime() > now;
      });
      setStories(active);
    } else {
      setStories([]);
    }
    setLoading(false);
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

  const addStory = useCallback((newStory) => {
    setStories(prev => [newStory, ...prev]);
  }, []);

  return { posts, stories, loading, fetchError, likePost, addPost, addStory, reload: loadPosts };
}

export function useLoungePost(postId) {
  const [post,     setPost]     = useState(null);
  const [comments, setComments] = useState([]);
  const [loading,  setLoading]  = useState(true);

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
