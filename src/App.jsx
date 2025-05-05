import React, { useState } from 'react';
import axios from 'axios';

const App = () => {
  const [channelUrl, setChannelUrl] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
  const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

  // Step 1: Extract channel identifier from URL
  const extractChannelInfo = (url) => {
    try {
      const u = new URL(url);
      const path = u.pathname.split('/').filter(Boolean);
      if (path[0] === 'channel') return { type: 'id', value: path[1] };
      if (path[0].startsWith('@')) return { type: 'handle', value: path[0] };
      if (path[0] === 'user' || path[0] === 'c') return { type: 'username', value: path[1] };
      return null;
    } catch {
      return null;
    }
  };

  // Step 2: Get Channel ID
  const resolveChannelId = async (info) => {
    if (!info) throw new Error('Invalid YouTube URL');
    if (info.type === 'id') return info.value;

    if (info.type === 'handle') {
      const res = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          part: 'snippet',
          q: info.value,
          type: 'channel',
          maxResults: 1,
          key: YOUTUBE_API_KEY,
        },
      });
      return res.data.items[0]?.snippet?.channelId;
    }

    if (info.type === 'username') {
      const res = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
        params: {
          part: 'id',
          forUsername: info.value,
          key: YOUTUBE_API_KEY,
        },
      });
      return res.data.items[0]?.id;
    }
  };

  // Step 3: Get Recent Video Titles/Descriptions
  const fetchVideos = async (channelId) => {
    const res = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        channelId,
        maxResults: 5,
        order: 'date',
        type: 'video',
        key: YOUTUBE_API_KEY,
      },
    });

    return res.data.items.map((item) => `${item.snippet.title}: ${item.snippet.description}`);
  };

  // Step 4: Send to OpenAI
  const analyzeVideos = async (videoTexts) => {
    const prompt = `
Analyze the following YouTube videos and respond with:
1. What type of channel is this? (Educational, Entertainment, Vlog, etc.)
2. Is the content useful or a waste of time? Why?
3. Summarize the common theme across these videos.
4. How can the channel improve its content?
5. How many videos are there in total?
6. What is the average length of the videos?
7. What is the average number of views?
Videos:
${videoTexts.join('\n')}
`;


    const res = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
    }, {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    return res.data.choices[0].message.content;
  };

  // Step 5: Handle Form
  const handleAnalyze = async () => {
    setLoading(true);
    setError('');
    setResult('');
    try {
      const info = extractChannelInfo(channelUrl);
      const channelId = await resolveChannelId(info);
      const videos = await fetchVideos(channelId);
      const analysis = await analyzeVideos(videos);
      setResult(analysis);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20, fontFamily: 'Arial, sans-serif' }}>
      <h2>YouTube Channel Analyzer</h2>
      <input
        value={channelUrl}
        onChange={(e) => setChannelUrl(e.target.value)}
        placeholder="Paste YouTube channel URL"
        style={{ width: '300px', padding: 8 }}
      />
      <button onClick={handleAnalyze} disabled={loading} style={{ marginLeft: 10 }}>
        {loading ? 'Analyzing...' : 'Analyze'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {result && (
        <div style={{ marginTop: 20, background: '#000', padding: 15, borderRadius: 5 }}>
          {result && (
            <div style={{
              marginTop: 20,
              padding: '1rem',
              borderRadius: 8,
              border: '1px solid #ddd',
              maxWidth: 600,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              lineHeight: 1.6,
            }}>
              {result}
            </div>
          )}

        </div>
      )}
    </div>
  );
};

export default App;
