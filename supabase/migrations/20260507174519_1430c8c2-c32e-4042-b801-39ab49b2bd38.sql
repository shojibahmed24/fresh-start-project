UPDATE project_files
SET content = replace(
                replace(
                  content,
                  E'import { Home, Search, Bell, Mail, User, MessageCircle, Repeat, Heart } from \'lucide-react\'',
                  E'import { Home, Search, Bell, Mail, User as UserIcon, MessageCircle, Repeat, Heart } from \'lucide-react\''
                ),
                '<User ', '<UserIcon '
              ),
    updated_at = now()
WHERE project_id = '23a48a3a-414e-4c14-b76c-39c8236fac6a'
  AND path = '/src/App.tsx';