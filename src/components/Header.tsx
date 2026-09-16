import { Link } from 'react-router-dom'
import kantahanLogo from "../assets/branding/kantahanLogo.png"

type HeaderProps = {
  title: string
}

function Header({ title }: HeaderProps) {
  return (
    <header className="w-full">
      <div className="mx-auto flex max-w-5xl items-center px-6 py-5">
        <Link to="/" className="font-semibold">
          <img src={kantahanLogo} alt="KantaHan Logo" className="h-10 w-10 headerLogo" />
        </Link>

        <div className="ml-auto text-lg font-semibold">
            {title}
        </div>
      </div>
    </header>
  )
}

export default Header