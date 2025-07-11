import fetch from 'node-fetch';

async function testArticleAPI() {
  const articleId = 'd2ad77d5-c879-48e3-8ccf-846f20f48d9b';
  const url = `http://127.0.0.1:3003/api/news/articles/${articleId}`;
  
  try {
    console.log(`Testing API: ${url}`);
    const response = await fetch(url);
    
    console.log(`Status: ${response.status}`);
    console.log(`Status Text: ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', errorText);
      return;
    }
    
    const data = await response.json();
    console.log('\nArticle data:');
    console.log(`- ID: ${data.id}`);
    console.log(`- Title: ${data.title}`);
    console.log(`- Sentences: ${data.sentences ? data.sentences.length : 'None'}`);
    console.log(`- First sentence: ${data.sentences?.[0]?.text || 'N/A'}`);
    
  } catch (error) {
    console.error('Error testing API:', error);
  }
}

testArticleAPI();