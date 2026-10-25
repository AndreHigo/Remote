const H264_MSE_MIME_TYPES = [
  'video/mp4; codecs="avc1.4D002A,mp4a.40.2"',
  'video/mp4; codecs="avc1.4D401F,mp4a.40.2"',
  'video/mp4; codecs="avc1.64002A,mp4a.40.2"',
  'video/mp4; codecs="avc1.4D002A"',
  'video/mp4; codecs="avc1.4D401F"',
  'video/mp4; codecs="avc1.64002A"'
];

function selectH264Mime(isTypeSupported, withAudio = false) {
  const candidates = withAudio ? H264_MSE_MIME_TYPES.slice(0, 3) : H264_MSE_MIME_TYPES.slice(3);
  return candidates.find((mime) => isTypeSupported(mime)) || null;
}

globalThis.remotoMedia = { H264_MSE_MIME_TYPES, selectH264Mime };
