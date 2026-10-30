# Recorded music

Recorded music for the parlor's player. The five tracks here were uploaded by
OFFICIAL INSPIRE (MP3 audio in an MP4 container, hence `.m4a`). Playlists with no
recording yet are filled by the generative (synthesized) tracks.

To add a track:

1. Put the file here (MP3, M4A or OGG), e.g. `downtown-jazz-01.mp3`.
2. Add an entry to `RECORDED_TRACKS` in `src/audio/tracks.ts`:

   ```ts
   {
     kind: 'file',
     id: 'downtown-jazz-01',
     title: 'Track title',
     mood: 'Warm & easy',
     category: 'downtown-jazz', // one of the six playlists
     duration: 0, // recorded tracks end on their own
     src: 'assets/music/downtown-jazz-01.mp3',
     artist: 'Performer, exactly as credited',
   }
   ```

Categories: `downtown-jazz`, `rappahannock-morning`, `woodland-ambience`,
`casino-lounge`, `lofi-card-table`, `midnight-solitaire`.
