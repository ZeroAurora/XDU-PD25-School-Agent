def naive_split(text, chunk_size=500, overlap=50):
    chunks = []
    start = 0
    if chunk_size <= overlap:
        raise ValueError("chunk_size must be greater than overlap")
    while start < len(text):
        end = min(len(text), start + chunk_size)
        chunks.append(text[start:end])
        start = end - overlap
        if start < 0:
            start = 0
        if start >= len(text):
            break
    return chunks
