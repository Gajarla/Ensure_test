// hooks
import { useSelector } from '../redux/store';

//
import { MAvatar } from './@material-extend';
import createAvatar from '../utils/createAvatar';

// ----------------------------------------------------------------------

export default function MyAvatar({ ...other }) {
  // const { user } = useAuth();
  const { currentUser } = useSelector((state) => state.user);

  return (
    <>
      {currentUser && (
        <MAvatar
          src={currentUser.photoURL}
          alt={currentUser.firstName}
          color={currentUser.photoURL ? 'default' : createAvatar(currentUser.firstName)?.color}
          {...other}
        >
          {createAvatar(currentUser.firstName)?.name}
        </MAvatar>
      )}
    </>
  );
}
