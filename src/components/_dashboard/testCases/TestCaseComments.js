import PropTypes from 'prop-types';
import { useState, useRef } from 'react';
import { Icon } from '@iconify/react';
import roundSend from '@iconify/icons-ic/round-send';
// material
import { Stack, TextField, IconButton, Avatar, Typography, Paper } from '@mui/material';
import MyAvatar from '../../MyAvatar';
import { fDate } from '../../../utils/formatTime';

// ----------------------------------------------------------------------

TestCaseComments.propTypes = {
  posts: PropTypes.array
};

export default function TestCaseComments({ posts }) {
  const [message, setMessage] = useState('');
  const commentInputRef = useRef(null);

  const handleChangeMessage = (event) => {
    setMessage(event.target.value);
  };
  return (
    <Stack spacing={3} sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center">
        <MyAvatar />
        <TextField
          multiline
          maxRows={3}
          fullWidth
          size="small"
          value={message}
          inputRef={commentInputRef}
          placeholder="Write a comment…"
          onChange={handleChangeMessage}
          sx={{
            ml: 2,
            mr: 1,
            '& fieldset': {
              borderWidth: `1px !important`,
              borderColor: (theme) => `${theme.palette.grey[500_32]} !important`
            }
          }}
        />
        <IconButton>
          <Icon icon={roundSend} width={24} height={24} />
        </IconButton>
      </Stack>

      <Stack spacing={1.5}>
        {posts[1]?.comments?.map((comment) => (
          <Stack key={comment.id} direction="row" spacing={2}>
            <Avatar alt={comment.author.name} src={comment.author.avatarUrl} />
            <Paper sx={{ p: 1.5, flexGrow: 1, bgcolor: 'background.neutral' }}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ sm: 'center' }}
                justifyContent="space-between"
                sx={{ mb: 0.5 }}
              >
                <Typography variant="subtitle2">{comment.author.name}</Typography>
                <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                  {fDate(comment.createdAt)}
                </Typography>
              </Stack>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {comment.message}
              </Typography>
            </Paper>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}
