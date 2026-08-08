import React from 'react';

const BookCard = ({ title, author, description, tags, darkMode }) => {
  const cardStyle = {
    backgroundColor: darkMode ? '#1e1e1e' : '#fff',
    color: darkMode ? '#f0f0f0' : '#333',
    padding: '20px',
    borderRadius: '10px',
    boxShadow: darkMode ? '0 4px 10px rgba(0,0,0,0.5)' : '0 4px 10px rgba(0,0,0,0.1)',
    marginBottom: '15px',
    transition: 'transform 0.2s',
    cursor: 'pointer',
    border: darkMode ? '1px solid #333' : '1px solid #eee'
  };

  return (
    <div style={cardStyle}>
      <h2 style={{ margin: '0 0 10px 0', color: '#3498db' }}>{title}</h2>
      <p style={{ fontSize: '0.9rem', fontStyle: 'italic', marginBottom: '10px' }}>by {author}</p>
      <p style={{ fontSize: '1rem', lineHeight: '1.5' }}>{description}</p>
      
      {/* CORRECCIÓN AQUÍ: Solo hace map si 'tags' existe y es una lista */}
      <div style={{ marginTop: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {tags && Array.isArray(tags) ? (
          tags.map((tag, index) => (
            <span key={index} style={{
              backgroundColor: darkMode ? '#333' : '#e0e0e0',
              padding: '5px 10px',
              borderRadius: '15px',
              fontSize: '0.8rem'
            }}>
              {tag}
            </span>
          ))
        ) : null}
      </div>
    </div>
  );
};

export default BookCard;