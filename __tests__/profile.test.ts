import { ApiError } from '../src/api/client';
import type { Owner } from '../src/types';
import {
  buildOwnerUpdateRequest,
  describeProfileSaveError,
  formatMemberSince,
  genderLabel,
  nicknameInitial,
} from '../src/utils/profile';

const owner: Owner = {
  id: 'o1',
  email: 'owner@example.com',
  nickname: 'marko',
  gender: 'male',
  avatar_url: 'https://cdn.example.com/a.jpg',
  visibility: { gender: false, avatar_url: true },
  created_at: '2026-10-03T10:00:00Z',
};

const unchanged = {
  nickname: owner.nickname,
  gender: owner.gender,
  avatarUrl: owner.avatar_url,
  visibility: owner.visibility,
};

describe('buildOwnerUpdateRequest', () => {
  test('nothing changed — empty body', () => {
    expect(buildOwnerUpdateRequest(owner, unchanged)).toEqual({});
    expect(
      buildOwnerUpdateRequest(owner, { ...unchanged, nickname: ' marko ' }),
    ).toEqual({});
  });

  test('removed gender and photo are sent as ""', () => {
    expect(
      buildOwnerUpdateRequest(owner, {
        ...unchanged,
        gender: null,
        avatarUrl: null,
      }),
    ).toEqual({ gender: '', avatar_url: '' });
  });

  test('only the changed visibility switches are sent', () => {
    expect(
      buildOwnerUpdateRequest(owner, {
        ...unchanged,
        nickname: 'marko2',
        visibility: { gender: true, avatar_url: true },
      }),
    ).toEqual({ nickname: 'marko2', visibility: { gender: true } });
  });
});

test('labels', () => {
  expect(genderLabel(null)).toBe('Не указан');
  expect(genderLabel('female')).toBe('Женский');
  expect(nicknameInitial(' ёжик')).toBe('Ё');
  expect(nicknameInitial('')).toBe('?');
  expect(formatMemberSince('2026-10-03T10:00:00Z')).toBe(
    'В Tailverse с октября 2026',
  );
  expect(formatMemberSince('nope')).toBeNull();
});

test('save errors are explained', () => {
  expect(
    describeProfileSaveError(
      new ApiError(400, {
        msg: 'UpdateMe',
        error: 'nickname is required: invalid argument',
      }),
    ),
  ).toBe('Никнейм — от 1 до 50 символов');
  expect(describeProfileSaveError(new ApiError(413, null))).toBe(
    'Файл слишком большой (максимум 10 МБ)',
  );
});
