const H264_MSE_MIME_TYPES = [
  'video/mp4; codecs="avc1.4D002A"',
  'video/mp4; codecs="avc1.4D401F"',
  'video/mp4; codecs="avc1.64002A"'
];

function selectH264Mime(isTypeSupported) {
  return H264_MSE_MIME_TYPES.find((mime) => isTypeSupported(mime)) || null;
}

globalThis.remotoMedia = { H264_MSE_MIME_TYPES, selectH264Mime };
