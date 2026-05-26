import { useState, useEffect, useCallback } from 'react';
import {
  IS_SUPABASE_READY,
  getLoungePosts,
  getLoungePost,
  getLoungeStories,
  getLoungeComments,
  softDeleteLoungeComment,
  getLoungeSeeds,
  likeLoungePost,
} from '../lib/supabase';

// seed 게시글이 많을 때 첫 페이지 노출 최소화 (실제 글 20개 이상이면 최대 3개)
const SEED_LIMIT_WHEN_PLENTY = 3;

function adaptSeedPost(s) {
  return {
    id:                   `seed_${s.id}`,
    _seed_post_id:        s.id,
    user_id:              null,
    anonymous_nickname:   s.nickname ?? '공간러',
    category:             s.category,
    title:                s.title ?? null,
    content:              s.content,
    image_urls:           s.image_urls ?? [],
    view_count:           0,
    like_count:           0,
    comment_count:        0,
    is_story:             false,
    is_deleted:           false,
    is_hidden:            false,
    is_seed:              true,
    has_badge:            false,
    region:               null,
    gender:               null,
    age_group:            null,
    created_at:           s.created_at,
    sort_order:           s.sort_order ?? 0,
  };
}

export function useLounge(category = 'all') {
  const [posts, setPosts]         = useState([]);
  const [stories, setStories]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [storiesError, setStoriesError] = useState(null);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    if (IS_SUPABASE_READY) {
      const [postsRes, storiesRes, seedsRes] = await Promise.all([
        getLoungePosts(category),
        getLoungeStories(),
        getLoungeSeeds(category),
      ]);

      const realPosts = postsRes.data ?? [];
      const seeds     = (seedsRes.data ?? []).map(adaptSeedPost);

      // 실제 글이 20개 이상이면 seed는 최대 3개만 노출
      const seedsToShow = realPosts.length >= 20
        ? seeds.slice(0, SEED_LIMIT_WHEN_PLENTY)
        : seeds;

      // 실제 글 먼저, seed 글은 뒤
      setPosts([...realPosts, ...seedsToShow]);
      setStories(storiesRes.data ?? []);
      setStoriesError(storiesRes.error ?? null);
    } else {
      // Supabase 미연결 시 빈 피드 (코드 목업 제거)
      await new Promise(r => setTimeout(r, 200));
      setPosts([]);
      setStories([]);
    }
    setLoading(false);
  }, [category]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  const likePost = useCallback(async (postId) => {
    if (postId?.startsWith('seed_')) return;
    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, like_count: (p.like_count ?? 0) + 1 } : p
    ));
    await likeLoungePost(postId);
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

  return { posts, stories, loading, storiesError, likePost, addPost, removePost, updatePost, addStory, removeStory, reload: loadPosts };
}

export function useLoungePost(postId, initialPost = null) {
  const [post, setPost]                             = useState(initialPost);
  const [comments, setComments]                     = useState([]);
  const [loading, setLoading]                       = useState(!initialPost);
  const [commentsFetchError, setCommentsFetchError] = useState(null);

  useEffect(() => {
    if (!postId) return;
    let cancelled = false;

    const load = async () => {
      if (!initialPost) setLoading(true);

      // seed 게시글은 DB 조회 없이 initialPost 사용
      const isSeedPost = postId?.startsWith('seed_');
      if (isSeedPost) {
        if (!cancelled) setLoading(false);
        return;
      }

      if (IS_SUPABASE_READY) {
        const [postRes, commentsRes] = await Promise.all([
          getLoungePost(postId),
          getLoungeComments(postId),
        ]);
        if (cancelled) return;
        if (postRes.data) setPost(postRes.data);
        if (commentsRes.error) {
          setCommentsFetchError(commentsRes.error.message);
        } else {
          setComments(commentsRes.data ?? []);
          setCommentsFetchError(null);
        }
      } else {
        await new Promise(r => setTimeout(r, 150));
        if (cancelled) return;
      }

      if (!cancelled) setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [postId]); // eslint-disable-line react-hooks/exhaustive-deps

  const refetchComments = useCallback(async () => {
    if (!postId || postId.startsWith('seed_')) return;
    const { data, error } = await getLoungeComments(postId);
    if (error) {
      setCommentsFetchError(error.message);
    } else {
      setComments(data ?? []);
      setCommentsFetchError(null);
    }
  }, [postId]);

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

  return { post, comments, loading, commentsFetchError, addComment, removeComment, likeComment, updatePostLocal, refetchComments, setPost };
}
