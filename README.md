# Polaris Axis

Figma 웹 1의 첫 화면만 구현한 검토용 웹사이트입니다. 다음 섹션은 사용자 확정 후 추가합니다.

```sh
npm install
npm run dev
```

- `npm run build`: 타입 검사와 프로덕션 빌드
- `npm run typecheck`: 타입 검사
- 디자인 기준: Figma `cp6V6mULrdEwoBwY2VtYCU`, 웹 1 `1:252`
- 첫 화면 전체에 실시간 Canvas 은하수와 커서 방향으로 기울어지는 중앙 입자와 흐르는 잔광을 표시합니다. 원본 이미지는 화면에 사용하지 않습니다.
- 배경의 PAUSE/PLAY 버튼으로 움직임을 제어할 수 있으며, 동작 감소 설정에서는 정적인 은하수를 표시합니다.
- 로컬 Roboto Serif 이탤릭 폰트는 Google Fonts에서 제공한 원본을 사용합니다.
- Apple SD Gothic Neo가 없는 환경에서는 Arial/sans-serif로 표시됩니다.

## Chrome에서 파일로 바로 열기

`npm run build` 후 저장소 루트의 `preview.html`을 Chrome으로 열면 서버 없이 확인할 수 있습니다. 배경 인터랙션과 폰트가 포함된 미리보기이며, 수정 후 다시 빌드하면 갱신됩니다. `index.html`은 Vite 실행용 진입 파일이므로 `npm run dev`를 통해 확인하세요.
